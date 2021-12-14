#!/usr/bin/tclsh
package require json

proc create_dev_html {name object bootstrapModule dir deps css js} {
    set _css [list]
    foreach _ $css {lappend _css "    <link rel=\"stylesheet\" type=\"text/css\" href=\"${_}\" />"}
    set _deps [list]
    foreach _ $deps {
        if { [string match {.*} $_] } {
            set _ "../${_}"
        }
        if { [regexp {^https?://} $_] && ![regexp {//admin.23video.com} $_] } {
            set sri_hash [sri_hash $_]
            lappend _deps "    <script src=\"${_}\" integrity=\"${sri_hash}\" crossorigin=\"anonymous\"></script>"
        } else {
            lappend _deps "    <script src=\"${_}\"></script>"
        }
    }
    set _js [list]
    foreach _ $js {lappend _js "    <script src=\"${_}\"></script>"}
    set fd [open [file join $dir "${name}.html"] w]
    puts $fd "<!DOCTYPE html>\n<html>\n  <head>\n    <meta name=\"viewport\" content=\"height=device-height,width=device-width,initial-scale=1.0,user-scalable=no\" />\n    <script>var GLUEDEV=true;</script>\n    <base target=\"_blank\">\n\n    <!-- Module stylesheets -->\n[join $_css \n]\n\n    <!-- Glue, jQuery, Liquid,js and other dependencies -->\n[join $_deps \n]\n\n    <!-- Bootstrap the Glue object and all modules -->\n    <script>var ${object} = new Glue({alias:'${name}'});</script>\n[join $_js \n]\n  </head>\n  <body>\n    <script>\n      ${object}.use('${bootstrapModule}',{});\n    </script>\n    <noscript><p>You must enable JavaScript to view this content.</p></noscript>\n  </body>\n</html>"
    close $fd
}

proc create_dist_html {name object bootstrapModule dir} {
    set fd [open [file join $dir "${name}.html"] w]
    puts $fd "<!DOCTYPE html>\n<html>\n  <head>\n    <base target=\"_blank\">\n    <meta name=\"viewport\" content=\"height=device-height,width=device-width,initial-scale=1.0,user-scalable=no\" />\n    <link rel=\"stylesheet\" type=\"text/css\" href=\"${name}.css\" />\n    <script src=\"${name}.js\"></script>\n  </head>\n  <body>\n    <script>\n      ${object}.use('${bootstrapModule}',{});\n    </script>\n    <noscript><p>You must enable JavaScript to view this content.</p></noscript>\n  </body>\n</html>"
    close $fd
}

proc sri_hash {url} {
    set hash [exec curl -s $url | openssl dgst -sha384 -binary | openssl base64 -A]
    return "sha384-${hash}"
}

proc concat_code {files output_filename dir {minify_type "none"}} {
    set content [list]
    foreach _ $files {
        if { [regexp {^https?://} $_] } {
            puts "Downloading file from $_"
            set tmp_content [exec curl -s $_]
        } elseif { [file exists [set joined_filename [file join $dir $_]]] } {
            puts "Using local code from $joined_filename"
            set fd [open $joined_filename r]
            set tmp_content [read $fd]
            close $fd
        } else {
            puts "Using inline code"
            set tmp_content $_
        }
        lappend content $tmp_content
    }
    set fd [open $output_filename w]
    puts $fd [join $content "\n\n"]
    close $fd

    if { ![regexp {\.min.(js|css)$} $_] && ($minify_type eq "js" || $minify_type eq "css") } {
        puts " --> minifying ${minify_type}"
        if { $minify_type eq "css" } {
            if { [catch {
                exec cssmin $output_filename > /tmp/glue-build-css-temp
                file copy -force /tmp/glue-build-css-temp $output_filename
            } err] } {
                puts "     (minifying failed: $err)"
            }
        } else {
            if { [catch {
                exec jsmin --overwrite $output_filename
            } err] } {
                puts "     (minifying failed: $err)"
            }
        }
    }
}

proc css_inline_data_uris {css_filename {max_file_size_kb "16"}} {
    package require base64

    set fd [open $css_filename r]
    set css [read $fd]
    close $fd
    set css_folder [file dirname $css_filename]

    foreach match [regexp -all -inline {[a-z\-]+\s*:[^;\{\}]+} $css] {
        if { [regexp {^(.+)url\([\'\"]?([^\)\'\"]+)[\'\"]?\)(.*)$} $match ignore before filename after] } {
            set filename [string map [list ".." "" "/" ""] $filename]
            switch -exact -- [file extension $filename] {
                .png {
                    set mime_type "image/png"
                }
                .gif {
                    set mime_type "image/gif"
                }
                .jpeg -
                .jpg {
                    set mime_type "image/jpeg"
                }
            }
            if { [info exists mime_type] } {
                set real_filename [file join $css_folder $filename]
                if { [file exists $real_filename] && [file size $real_filename]<=[expr $max_file_size_kb*1024] } {
                    set fd [open $real_filename r]
                    fconfigure $fd -translation binary
                    set data [base64::encode -wrapchar "" [read $fd]]
                    close $fd
                    set uri_expression "${before}url('data:${mime_type};base64,${data}')${after}"
                    # Use the old express with an IE7 hack to support the non-data uri case
                    set new_css_expression "${uri_expression}; *${match}"
                    #set new_css_expression "${uri_expression}"
                    set css [string map [list $match $new_css_expression] $css]
                }
            }
            catch {unset mime_type}
        }
    }

    set fd [open $css_filename w]
    puts $fd $css
    close $fd
}

set manifest_filename [file join [pwd] [lindex $argv 0]]
set manifest_dir [file dirname $manifest_filename]
set src_dir [file join $manifest_dir src]
set fd [open $manifest_filename r]
set manifest_json [read $fd]
close $fd
set manifest [json::json2dict $manifest_json]

# Version
set glueVersion [dict get $manifest glueVersion]
if { $glueVersion ne "1" } {
    puts "The manifest cannot be compiled with this version of Glue"
    exit
}

# Names
set name [dict get $manifest name]
set object [dict get $manifest object]
set bootstrapModule [dict get $manifest bootstrapModule]

# Dependencies
set glueLocation [dict get $manifest glueLocation]
set dependencies [dict get $manifest dependencies]
if { ![dict exists $manifest hasGlueDependencies] || ![dict get $manifest hasGlueDependencies] } {
    set glueDependencies [list \
                              "https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js" \
                              "https://admin.23video.com/resources/um/script/kickem/liquid.ymin.js" \
                              [file join $glueLocation "glue.js"] \
                             ]
    set dependencies [concat $glueDependencies $dependencies]
}
if { [dict exists $manifest buildDependencies] } {
    set build_dependencies [dict get $manifest buildDependencies]
} else {
    set build_dependencies $dependencies
}

# Modules
set modules [dict get $manifest modules]
set css_files [list]
set css_paths [list]
set js_files [list]
set js_paths [list]
set liquid_files [list]
set liquid_script [list]
set other_files [list]
foreach module $modules {
    foreach filename [glob -nocomplain [file join $src_dir $module *]] {
        set path "${module}/[file tail $filename]"
        switch -exact [file extension $filename] {
            ".css" {
                lappend css_files $filename
                lappend css_paths $path
            }
            ".js" {
                lappend js_files $filename
                lappend js_paths $path
            }
            ".liquid" {
                lappend liquid_files $path $filename
                set fd [open $filename r]
                set liquid [read $fd]
                close $fd
                set liquid [string map [list "\r" "" "\n" "\\n" "\"" "\\\""] $liquid]
                lappend liquid_script "${object}.liquidTemplates\['${path}'] = \"${liquid}\";"
            }
            default {
                lappend other_files $filename
            }
        }
    }
}

# Distribution version
set dist_dir [file join $manifest_dir dist]
file delete -force $dist_dir
file mkdir $dist_dir
foreach _ $other_files {
    catch {
        file copy $_ $dist_dir
    }
}
set js_filename [file join $dist_dir "${name}.js"]
concat_code [concat \
                 [list "profilingStartTime = (new Date()).getTime();"] \
                 $build_dependencies \
                 [list "var ${object} = new Glue({alias:'${name}'});"] \
                 $liquid_script \
                 $js_files \
                ] $js_filename $manifest_dir js
set css_filename [file join $dist_dir "${name}.css"]
concat_code $css_files $css_filename $manifest_dir css
css_inline_data_uris $css_filename
create_dist_html $name $object $bootstrapModule $dist_dir

# Development version
create_dev_html $name $object $bootstrapModule $src_dir $dependencies $css_paths $js_paths
