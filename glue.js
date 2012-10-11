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
  - glue:loaded
  - glue:reset
  - glue:render
*/
if(!console){var console = {log:function(){},debug:function(){alert(arguments[0])}};}

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
      console.log(arguments[2]);
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
          var m = new coreModule[1]($this,$,$.extend({_id:$this.modules.length, moduleName:name, container:moduleContainer, _initRender:[], render:function(){this._initRender=[arguments[0], arguments[1], arguments[2]];}},coreModule[0],properties));
          // The module is loaded, allow for rendering
          m.render = function(callback, path, container){
            callback = callback||function(){};
            path = $this.loadPath+path||$this.loadPath+m.moduleName+'/'+m.moduleName+'.liquid';
            container = container||moduleContainer;
            $this.readLiquidFile(path, function(tmpl){
                $(container).html(tmpl.render({module:m}));
                
                // Handle simple click/enter/leave commands
                $(container).find('*[click]').each(function(i,el){
                    $(el).click({command:$(el).attr('click')}, _runCommand);
                  });
                $(container).find('*[enter]').each(function(i,el){
                    $(el).mouseenter({command:$(el).attr('enter')}, _runCommand);
                  });
                $(container).find('*[leave]').each(function(i,el){
                    $(el).mouseleave({command:$(el).attr('leave')}, _runCommand);
                  });

                $this.fire('glue:render', $(container));
                callback();
              });
          }
          // ... and then render is m.render() was called during initiation
          if(m._initRender.length>0) m.render(m._initRender[0], m._initRender[1], m._initRender[2]);
          
          // Set a class name for the container
          if(m&&m.container) {
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
  var _runCommand = function(e){
    var d = e.data||e;
    $.each(d.command.split(';'), function(i,s){
        var a = s.trim().substr(1).split(':');
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
        case 'set':
          $this.set(k, v);
          break;
        }
      });
  }

  /* EVENTS */
  $this.events = {};
  $this.bind = function(e,f){
    $.each(e.split(' '), function(i,e){
        $this.events[e] = $this.events[e]||[];
        $this.events[e].push(f);
      });
  }
  $this.fire = function(e,o){
    $.each($this.events[e]||[], function(i,f){
        var ret = f(e,o);
        if(typeof(ret)!='undefined') o = ret;
      });
    return o;
  }

  /* DYNAMIC PROPERTIES */
  $this.getters = {};
  $this.getter = function(prop,f){
    $this.getters[prop] = f;
  }
  $this.get = function(prop){
    if($this.getters[prop]){
      return $this.getters[prop](prop);
    } else {
      throw "No getter for property '"+prop+"'";
    }
  }
  $this.setters = {};
  $this.setter = function(prop,f){
    $this.setters[prop] = f;
  }
  $this.set = function(prop,value){
    if($this.setters[prop]){
      return $this.setters[prop](value,prop);
    } else {
      throw "No setter for property '"+prop+"'";
    }
  }

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

  /* PANIC! */
  $this.fail = function(err){throw err;}

  /* MODIFY LIQUID.JS FOR OUR PURPOSES */
  // Read in a template file, either from cache or from 
  $this.liquidTemplates = {};
  $this.readLiquidFile = function(url, callback) {
    if ($this.liquidTemplates[url]) {
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
