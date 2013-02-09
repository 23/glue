#!/usr/bin/tclsh
package require json
package require http
package require tls
::http::register https 443 ::tls::socket

proc create_dev_html {name object bootstrapModule dir deps css js} {
    set _css [list]
    foreach _ $css {lappend _css "    <link rel=\"stylesheet\" type=\"text/css\" href=\"${_}\" />"}
    set _deps [list]
    foreach _ $deps {if {[string match {.*} $_]} {set _ "../${_}"}; lappend _deps "    <script src=\"${_}\"></script>"}
    set _js [list]
    foreach _ $js {lappend _js "    <script src=\"${_}\"></script>"}
    set fd [open [file join $dir "${name}.html"] w]
    puts $fd "<!DOCTYPE html>\n<html>\n  <head>\n    <script>var GLUEDEV=true;</script>\n\n    <!-- Module stylesheets -->\n[join $_css \n]\n\n    <!-- Glue, jQuery, Liquid,js and other dependencies -->\n[join $_deps \n]\n\n    <!-- Bootstrap the Glue object and all modules -->\n    <script>var ${object} = new Glue({alias:'${name}'});</script>\n[join $_js \n]\n  </head>\n  <body>\n    <script>\n      ${object}.use('${bootstrapModule}',{});\n    </script>\n    <noscript><p>You must enable JavaScript to view this content.</p></noscript>\n  </body>\n</html>"
    close $fd
}

proc create_dist_html {name object bootstrapModule dir} {
    set fd [open [file join $dir "${name}.html"] w]
    puts $fd "<!DOCTYPE html>\n<html>\n  <head>\n    <link rel=\"stylesheet\" type=\"text/css\" href=\"${name}.css\" />\n    <script src=\"${name}.js\"></script>\n  </head>\n  <body>\n    <script>\n      ${object}.use('${bootstrapModule}',{});\n    </script>\n    <noscript><p>You must enable JavaScript to view this content.</p></noscript>\n  </body>\n</html>"
    close $fd
}

proc concat_code {files output_filename {minify_type "none"}} {
    set content [list]
    foreach _ $files {
        if { [regexp {^https?://} $_] } {
            set tok [http::geturl $_]
            lappend content [http::data $tok]
            http::cleanup $tok
        } elseif { [file exists $_] } {
            set fd [open $_ r]
            lappend content [read $fd]
            close $fd
        } else {
            lappend content $_
        }
    }
    set content [join $content "\n\n"]

    if { $minify_type eq "js" || $minify_type eq "css" } {
        set tok [http::geturl "http://reducisaurus.appspot.com/${minify_type}" -timeout 30000 -query [http::formatQuery file $content]]
        set content [http::data $tok]
        http::cleanup $tok
    }

    set fd [open $output_filename w]
    puts $fd $content
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
set glueDependencies [list \
                          "http://code.jquery.com/jquery-1.8.3.min.js" \
                          "http://admin.23video.com/resources/um/script/kickem/liquid.ymin.js" \
                          [file join $glueLocation "glue.js"] \
                         ]
set dependencies [concat $glueDependencies [dict get $manifest dependencies]]

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
    file copy $_ $dist_dir
}
concat_code [concat \
                 [list "profilingStartTime = (new Date()).getTime();"] \
                 $dependencies \
                 [list "var ${object} = new Glue({alias:'${name}'});"] \
                 $liquid_script \
                 $js_files \
                ] [file join $dist_dir "${name}.js"] js
concat_code $css_files [file join $dist_dir "${name}.css"] css
create_dist_html $name $object $bootstrapModule $dist_dir

# Development version
create_dev_html $name $object $bootstrapModule $src_dir $dependencies $css_paths $js_paths
