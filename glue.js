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
*/
var Glue = window.Glue = (function($){
    var Glue = this;
    Glue.version = '0.0.1';

    /* UTILITY & DEBUGGING */
    Glue.log = function(){
      if(arguments[0]!='error') return;
      console.log(arguments);
    }

    /* QUERY PARAMETERS */
    Glue.parametersString = location.search.substr(1);
    Glue.parameters = {};
    if(Glue.parametersString.length>0){
        $.each(Glue.parametersString.split('&'), function(i,comp){
            var s = comp.split('=');
            Glue.parameters[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
        });
    }

    /* MODULES */
    /* Call this to register a new module */
    Glue.providedModules = {};
    Glue.modules = {};
    Glue.provide = function(name,opts,f){
        opts = opts||{};
        Glue.providedModules[name] = [opts,f];
    }
    Glue.use = function(name, properties){
        if(!$.isArray(name)) name=[name];
        $.each(name, function(index,name){
            if(!Glue.providedModules[name]) {
                Glue.log('error', "Module '" + name + "' doesn't exist");
                return;
            }
            if(Glue.modules[name]) {
              // Module has already been loaded
              Glue.log('debug', "Module '" + name + "' has already been loaded");
              return;
            }
            
            try {
                Glue.log('debug', 'Loading', name);
                // Create a default container for the module
                var moduleContainer = $(document.createElement('div'));
                // Load the module
                var m = Glue.providedModules[name];
                m = Glue.modules[name] = m[1](Glue,$,$.extend({container:moduleContainer},m[0],properties));
                m.moduleName = name;
                // Set a class name for the container
                if(m&&m.container) {
                  if(m.className) {
                    m.container.addClass(m.className);
                  } else {
                    m.container.addClass('glue-'+name);
                  }
                }
                // Create a rendering function for the template
                m.render = function(path){
                  path = path||m.moduleName+'/'+m.moduleName+'.liquid';
                  Glue.readLiquidFile(path, function(tmpl){
                      $(m.container).html(tmpl.render(Glue));
                    });
                }
            }catch(err){
                Glue.log('error', "Module '" + name + "' could not be loaded", err);
            }
        });
    }


    /* EVENTS */
    Glue.events = {};
    Glue.bind = function(e,f){
        $.each(e.split(' '), function(i,e){
            Glue.events[e] = Glue.events[e]||[];
            Glue.events[e].push(f);
        });
    }
    Glue.fire = function(e,o){
        $.each(Glue.events[e]||[], function(i,f){
            var ret = f(e,o);
            if(typeof(ret)!='undefined') o = ret;
        });
        return o;
    }

    /* DYNAMIC PROPERTIES */
    Glue.getters = {};
    Glue.getter = function(prop,f){
        Glue.getters[prop] = f;
    }
    Glue.get = function(prop){
        if(Glue.getters[prop]){
            return Glue.getters[prop](prop);
        } else {
            throw "No getter for property '"+prop+"'";
        }
    }
    Glue.setters = {};
    Glue.setter = function(prop,f){
        Glue.setters[prop] = f;
    }
    Glue.set = function(prop,value){
        if(Glue.setters[prop]){
            return Glue.setters[prop](value,prop);
        } else {
            throw "No setter for property '"+prop+"'";
        }
    }

    /* BOOTSTRAPPING */
    Glue.settings = $.extend({}, Glue.parameters);

    // Handle actual loading
    Glue.loaded = false;
    Glue.container = null;
    Glue.app = null;
    Glue.fire('glue:init');
    Glue.load = function(template,container){
      Glue.container = container;
      Glue.template = template;
      Glue.readLiquidFile(Glue.template, function(tmpl){
           $(Glue.container).html(tmpl.render(Glue));
           Glue.loaded = false;
        });

    }

    /* PANIC! */
    Glue.fail = function(err){throw err;}

    /* MODIFY LIQUID.JS FOR OUR PURPOSES */
    // Read in a template file, either from cache or from 
    Glue.liquidTemplates = {};
    Glue.readLiquidFile = function(url, callback) {
      if (Glue.liquidTemplates[url]) {
        callback(Glue.liquidTemplates[url]);
      } else {
        $.ajax({
            url:url,
            success:function(res) {
              var tmpl = Liquid.parse(res);
              Glue.liquidTemplates[url] = tmpl;
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
    Glue.stubReplace = function(scheduled){
      if(typeof(scheduled)=='undefined' && _stubReplacerRunning) return;
      _stubReplacerRunning = true;
      var stubs = $('span.glue-stub');
      if(stubs.length>0) {
        $(stubs).each(function(i,stub){
            var moduleName = $(stub).attr('rel');
            if(Glue.modules[moduleName] && Glue.modules[moduleName].container) {
              // There's a container waiting to be sub'ed in
              $(stub).replaceWith(Glue.modules[moduleName].container);
            }else{
              // Either the module didn't load, or the module
              // doesn't use its container. Remove tmp stub.
              $(stub).remove();
            }
          });
        _stubReplacerRunning = false;
      } else {
        window.setTimeout(function(){Glue.stubReplace(1);}, 500);
      }
    }
    Liquid.Template.registerTag('glue', Liquid.Tag.extend({
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
         Glue.use(this.attributes.module, this.attributes.properties);
         // Return placeholder HTML to be replace with the module container
         Glue.stubReplace();
         return '<span style="display:none; position:absolute; top:-100px;" class="glue-stub" rel="'+this.attributes.module+'"></span>';
       }
    }));

    // SUPPORT GLUE GETTER VARS IN LIQUID
    Liquid.Context.prototype.get = function(varname) {
      var ret = this.resolve(varname);
      try {if(ret==null) ret = Glue.get(varname);}catch(e){};
      return ret;
    }

    return Glue;
})(jQuery);







