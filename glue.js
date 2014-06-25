/* 
  LIQUID GLUE
  - Modules are set up with .use()
  - Exposes global properties with .setter()/.getter()
  - Read or write global properties with .set()/.get()
  - Listens to events with .bind()
  - Events can be used in a middleware-ish way where an object
    is passed through multiple events handlers, each of which
    may opt to manipulate the object and return the new version.

  Fires events:
  - glue:init
  - glue:render
  - glue:added
*/
if(!window.console){window.console = {log:function(){},debug:function(){}};}

var Glue = function(opts){
  if( typeof(Liquid)=='undefined' ) {
    alert('Liquid.js is required by Glue');
    return;
  }
  var $ = jQuery;
  var $this = this;

  /* ADDITIONAL OPTIONS */
  opts=opts||{};
  $this.alias = opts.alias||null;
  $this.loadPath = opts.loadPath||'';

  /* UTILITY & DEBUGGING */
  $this.log = function(){
    //if(arguments[0]!='error') return;
    try {
      if(typeof(GLUEDEV)!='undefined') console.log(arguments[1], arguments[2]);
    }catch(e){};
  }

  /* QUERY PARAMETERS */
  $this.parametersString = location.search.substr(1);
  $this.parameters = {};
  if($this.parametersString.length>0){
    $.each($this.parametersString.split('&'), function(i,comp){
        var s = comp.split('=');
        $this.parameters[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
      });
  }

  /* MODULES */
  /* Call this to register a new module */
  $this.bootstrapped = false;
  $this.providedModules = {};
  $this.modules = [];
  $this.provide = function(name,opts,f){
    opts = opts||{};
    $this.providedModules[name] = [opts,f];
  }
  $this.use = function(name, properties){
    if(!$.isArray(name)) name=[name];
    var ret = [];
    $.each(name, function(index,name){
        if(!$this.providedModules[name]) {
          $this.log('error', "Module '" + name + "' doesn't exist");
          return;
        }
        try {
          $this.log('debug', 'Loading', name);
          // Create a default container for the module
          var moduleContainer = $(document.createElement('div'));
          // Load the module
          var coreModule = $this.providedModules[name];
          var relativePath = (typeof(GLUEDEV)!='undefined' ? name+'/' : './');
          var m = new coreModule[1]($this,$,$.extend({_id:$this.modules.length, moduleName:name, path:relativePath, container:moduleContainer, _initRender:[], render:function(){this._initRender=[arguments[0], arguments[1], arguments[2]];}},coreModule[0],properties));
          // The module is loaded, allow for rendering
          m.render = function(callback, path, container){
            callback = callback||function(){};
            path = $this.loadPath+(path||m.moduleName+'/'+m.moduleName+'.liquid');
            container = container||moduleContainer;
            $this.readLiquidFile(path, function(tmpl){
                var currentHTML = $(container).html();
                var html = tmpl.render({module:m}).replace(/\s+$/,'').replace(/^\s+/,'');

                if(html!=currentHTML) {
                  if(currentHTML=='' && html!='' && m.showAnimation) {
                    // Animate from nothing to something
                    if(typeof(m.showAnimation.length)=='undefined') m.showAnimation = [m.showAnimation];
                    if(typeof(m.showAnimation[0].display)=='undefined') m.showAnimation[0].display = 'block';
                    if(m.showAnimation.length<2) m.showAnimation[1] = 500;
                    if(m.showAnimation.length<3) m.showAnimation[2] = {};
                    $(container)
                      .hide()
                      .html(html)
                      .animate(m.showAnimation[0], m.showAnimation[1]||500);
                  } else if(currentHTML!='' && html=='' && m.hideAnimation) {
                    // Animate from something to nothing
                    if(typeof(m.hideAnimation.length)=='undefined') m.hideAnimation = [m.hideAnimation];
                    if(typeof(m.hideAnimation[0].display)=='undefined') m.hideAnimation[0].display = 'none';
                    if(m.hideAnimation.length<2) m.hideAnimation[1] = 500;
                    if(m.hideAnimation.length<3) m.hideAnimation[2] = {};
                    $(container)
                      .css(m.hideAnimation[2])
                      .animate(m.hideAnimation[0], m.hideAnimation[1], function(){
                        $(container).html('');
                      });
                  } else {
                    $(container).html(html);
                  }
                  
                  // Handle simple click/enter/leave commands
                  $(container).find('*[click]').each(function(i,el){
                    $(el).click({command:$(el).attr('click')}, $this.runCommand);
                  });
                  $(container).find('*[enter]').each(function(i,el){
                    $(el).mouseenter({command:$(el).attr('enter')}, $this.runCommand);
                  });
                  $(container).find('*[leave]').each(function(i,el){
                    $(el).mouseleave({command:$(el).attr('leave')}, $this.runCommand);
                  });
                }

                $this.fire('glue:render', $(container));
                if (!$this.bootstrapped) {
                  $this.bootstrapped = true;
                  $this.fire('glue:bootstrapped');
                }
                callback();
              });
          }
          // ... and then render is m.render() was called during initiation
          if(m._initRender.length>0) m.render(m._initRender[0], m._initRender[1], m._initRender[2]);
          
          // Set a class name for the container
          if(m&&m.container) {
            m.container.addClass('glue-element');
            if(m.className) {
              m.container.addClass(m.className);
            } else {
              m.container.addClass('glue-'+name);
              if($this.alias) m.container.addClass($this.alias+'-'+name);
            }
          }

          // Finally, save the status
          $this.modules.push(m);
          ret.push(m);
        }catch(err){
          $this.log('error', "Module '" + name + "' could not be loaded", err);
        }
      });
    return(ret);
  }

  // Parse a string to run simple set/toggle commands
  $this.runCommand = function(e){
    var d = e.data||e;
    $.each(d.command.split(';'), function(i,s){
        s = (s.trim ? s.trim() : s.replace(/^\s+|\s+$/g, ''));
        var a = s.substr(1).split(':');
        // Rough string conversion
        var k = a[1];
        if(a.length>=3) {
          var v = a[2];
          if(isNaN(v)){
            if(v=='true') v = true;
            else if(v=='false') v = false;
          } else {
            v = new Number(v);
          }
        }
        switch(a[0]) {
        case 'toggle':
          $this.set(k, !$this.get(k));
          break;
        case 'fire':
          $this.fire(a.slice(1).join(':'), {});
          break;
        case 'set':
          $this.set(k, v);
          break;
        }
      });
  }

  /* EVENTS */
  $this.events = {};
  $this.bind = function(e,f,q){
    $.each(e.split(' '), function(i,e){
        $this.events[e] = $this.events[e]||[];
        $this.events[e].push(f);
      });
    // If q, check for matching past events in event queue
    if (q) {
      for (var i = 0; i < $this.queuedEvents.length; i += 1) {
        if ($this.queuedEvents[i].e == e) {
          f($this.queuedEvents[i].e,$this.queuedEvents[i].o);
        }
      }
    }
  }
  $this.fire = function(e,o){
    $.each($this.events[e]||[], function(i,f){
        //$this.profile(e);
        try {
          var ret = f(e,o);
          if(typeof(ret)!='undefined') o = ret;
        }catch(err){
          $this.log('error', 'Error while firing ' + e + ': ' + err);
        }
      });
    // Queue events that fires before the bootstrap module is rendered
    if (!$this.queuedEventsProcessed) {
      $this.queuedEvents.push({e:e,o:o});
    }
    return o;
  }

  /* DYNAMIC PROPERTIES */
  $this.getters = {};
  $this.getter = function(prop,f){
    $this.getters[prop] = f;
  }
  $this.get = function(prop,a,b,c,d){
    if($this.getters[prop]){
      return $this.getters[prop](prop,a,b,c,d);
    } else {
      $this.log("error", "No getter for property '"+prop+"'");
    }
  }
  $this.setters = {};
  $this.setter = function(prop,f,shortcut){
    $this.setters[prop] = f;
    if(shortcut) $this.addShortcut(shortcut,prop);
  }
  $this.set = function(prop,value){
    if($this.setters[prop]){
      return $this.setters[prop](value,prop);
    } else {
      $this.log("error", "No setter for property '"+prop+"'");
    }
  }

  /* GLUEFRAME */
  $this.queuedEvents = [];
  $this.queuedEventsProcessed = false;
  $this.getter("bootstrapped", function(){
    return $this.bootstrapped?true:false;
  });
  $this.setter("queuedEventsProcessed", function(p){
    $this.queuedEventsProcessed = true;
    $this.queuedEvents = [];
  });
  // Respond to a message event
  $this.respond = function(response, source, origin) {
    source.postMessage(JSON.stringify(response), origin);
  };
  // Parse received message
  $this.receiveMessage = function(e){
    var data = JSON.parse(e.data);
    var response;
    if (data.f === "get" || data.f === "set" || data.f === "fire") {
      response = {cbId:data.cbId, a:$this[data.f].apply(null, data.args)};
    }
    if (data.f === "bind") {
      $this.bind(data.args[0], (function(source, origin, data){
        return function(event,o){
          try {
            $this.respond({cbId:data.cbId, a:event, b:o}, source, origin);
          } catch(e) {
            $this.respond({cbId:data.cbId, a:event}, source, origin);
          }
        }
      })(e.source, e.origin, data), data.triggerQueue);
    }
    if (response !== undefined) {
      $this.respond( response, e.source, e.origin );
    }
  };
  $this.bind("glue:bootstrapped",function(){
    // Tell parent frame that we're ready
    $this.respond({ready: true}, parent, "*");
    // Delete queued events if they're not processed within 5 sec
    window.setTimeout(function(){
      if (!$this.queuedEventsProcessed) {
        $this.queuedEventsProcessed = true;
        $this.queuedEvents = [];
      }
    }, 5000);
  });
  // Listen for message events
  if (window.addEventListener) {
    window.addEventListener("message", $this.receiveMessage, false);
  } else {
    window.attachEvent("onmessage", $this.receiveMessage);
  }

  
  /* SHORTCUTS TO SETTERS */
  $this.specialKeys = {'backspace': 8, 'tab': 9, 'enter': 13, 'pause': 19, 'capslock': 20, 'esc': 27, 'space': 32, 'pageup': 33, 'pagedown': 34, 'end': 35, 'home': 36, 'left': 37, 'up': 38, 'right': 39, 'down': 40, 'insert': 45, 'delete': 46, 'f1': 112, 'f2': 113, 'f3': 114, 'f4': 115, 'f5': 116, 'f6': 117, 'f7': 118, 'f8': 119, 'f9': 120, 'f10': 121, 'f11': 122, 'f12': 123, '?': 191};
  $this.shortcuts = [];
  $this.addShortcut = function(shortcut,prop){
    if(!shortcut||typeof(shortcut.length)=='undefined'||shortcut.length==0) return;
    if($.isArray(shortcut[0])) {
      // Multiple shortcuts
      $.each(shortcut, function(i,sc){
        $this.shortcuts.push([sc,prop]);
      });
    } else {
      // Single shortcut
      $this.shortcuts.push([shortcut,prop]);
    }
  }
  // Listen to shortcuts
  $(document).keydown(function(e){
    $.each($this.shortcuts, function(i,item) {
      var shortcut = item[0];
      var prop = item[1];
      var matched = (shortcut.length>0)
      $.each(shortcut, function(i,str){
        switch(str) {
        case 'ctrl':
          matched = matched && e.ctrlKey;
          break;
        case 'alt':
          matched = matched && e.altKey;
          break;
        case 'meta':
          matched = matched && e.metaKey;
          break;
        default:
          if($this.specialKeys[str.toLowerCase()]) {
            matched = matched && (e.which==$this.specialKeys[str.toLowerCase()]);
          } else {
            matched = matched && (String.fromCharCode(e.which)==str.toUpperCase());
          }
          break;
        }
      });
      if(matched) {
        $this.setters[prop](shortcut);
        e.preventDefault();
      }
    });
  });

  /* TRANSLATIONS */
  var defaultLocale = "en";
  $this.setDefaultLocale = function(locale){
    defaultLocale = locale.substring(0,2);
  };
  var language = "en";
  // Use navigator.language in browsers and navigator.browserLanguage in <IE11
  if(typeof navigator != "undefined" && typeof navigator.language != "undefined"){
    language = (""+navigator.language).substring(0,2);
  }else if(typeof navigator != "undefined" && typeof navigator.browserLanguage != "undefined"){
    language = (""+navigator.browserLanguage).substring(0,2);
  }
  $this.fire("glue:localechange", language);
  $this.setLocale = function(locale){
    if(locale != language){
      language = locale;
      $this.fire("glue:localechange", language);
    }
  };
  $this.translations = {};
  $this.translate = function(key, newTranslations){
    if(typeof newTranslations === "object"){
      // Add the new translations to our translations object
      if(typeof $this.translations[key] != "undefined"){
        $.extend($this.translations[key], newTranslations);
      }else{
        $this.translations[key] = newTranslations;
      }
      return $this.translations;
    }else if(typeof $this.translations[key] != "undefined"){
      // We have a translation for this key
      if(typeof $this.translations[key][language] != "undefined"){
        // Return the preferred translation
        return $this.translations[key][language];
      }else if(typeof $this.translations[key][defaultLocale] != "undefined"){
        // Return default locale translation
        return $this.translations[key][defaultLocale];
      }else{
        // There is no translation for default locale, return any translation
        return $this.translations[key][Object.keys($this.translations[key])[0]];
      }
    }
    // No translations for this key
    return key;
  };

  Liquid.Template.registerFilter({
    translate: $this.translate
  });

  /* BOOTSTRAPPING */
  $this.settings = $.extend({}, $this.parameters);

  // Handle actual loading
  $this.loaded = false;
  $this.container = null;
  $this.app = null;
  $this.fire('glue:init');
  $this.load = function(template,container){
    $this.container = container;
    $this.template = template;
    $this.readLiquidFile($this.template, function(tmpl){
        $($this.container).html(tmpl.render($this));
        $this.loaded = false;
      });

  }

  /* PROFILING */
  $this.profilingStartTime = (typeof(profilingStartTime)!='undefined' ? profilingStartTime : (new Date()).getTime());
  $this.profile = function(message){console.debug((new Date()).getTime()-$this.profilingStartTime, message);}

  /* PANIC! */
  $this.fail = function(err){console.log(err); throw err;}

  /* MODIFY LIQUID.JS FOR OUR PURPOSES */
  // Read in a template file, either from cache or from 
  $this.liquidTemplates = {};
  $this.readLiquidFile = function(url, callback) {
    if ($this.liquidTemplates[url]) {
      if(!$this.liquidTemplates[url].parse) $this.liquidTemplates[url] = Liquid.parse($this.liquidTemplates[url]);
      callback($this.liquidTemplates[url]);
    } else {
      $.ajax({
          url:url,
          success:function(res) {
            var tmpl = Liquid.parse(res);
            $this.liquidTemplates[url] = tmpl;
            callback(tmpl);
          }
        });
    }
  }
  // Since liquid is stricly for strings we need to 
  // run some post-rendering magic/hacking with the 
  // DOM. This is done by inserting a temporary <span>
  // Which in turn is replace with the module's 
  // container <div>.
  var _stubReplacerRunning = false;
  $this.stubReplace = function(scheduled){
    if(typeof(scheduled)=='undefined' && _stubReplacerRunning) return;
    _stubReplacerRunning = true;
    var stubs = $('span.glue-stub');
    if(stubs.length>0) {
      $(stubs).each(function(i,stub){
          var moduleId = $(stub).attr('rel').substr(4);
          if($this.modules[moduleId] && $this.modules[moduleId].container) {
            // There's a container waiting to be sub'ed in
            $(stub).replaceWith($this.modules[moduleId].container);
            if($this.modules[moduleId].onAppend) $this.modules[moduleId].onAppend();
            $this.fire('glue:added', $this.modules[moduleId].container);
          }else{
            // Either the module didn't load, or the module
            // doesn't use its container. Remove tmp stub.
            $(stub).remove();
          }
        });
      _stubReplacerRunning = false;
    } else {
      window.setTimeout(function(){$this.stubReplace(1);}, 500);
    }
  }
  var glueTag = Liquid.Tag.extend({
      tagSyntax: /([a-zA-Z0-9_-]+)(\s+(?:with)\s+(.+))?/,
        
      init: function(tag, markup, tokens) {
        var m = markup.match(this.tagSyntax);
        this.attributes = {};
        this.attributes['module'] = m[1];
        this.attributes['properties'] = (m[3] ? $.parseJSON('{' + m[3] + '}') : {});
        this._super(tag, markup, tokens);
      }, 
      render: function(context) {
        // Load up the module with properties
        var m = $this.use(this.attributes.module, this.attributes.properties)[0];
        // Return placeholder HTML to be replace with the module container
        $this.stubReplace();
        return '<span style="display:none; position:absolute; top:-100px;" class="glue-stub" rel="glue'+m._id+'"></span>';
      }
    });
  Liquid.Template.registerTag('glue', glueTag);
  if($this.alias) Liquid.Template.registerTag($this.alias, glueTag);

  // SUPPORT GLUE GETTER VARS IN LIQUID
  Liquid.Context.prototype.get = function(varname) {
    var ret = this.resolve(varname);
    try {if(ret==null) ret = $this.get(varname);}catch(e){};
    return ret;
  }

  return $this;
};
