# What is Glue?

Glue is a deliberately simple JavaScript application framework, built on top of Liquid.js and jQuery. The library lets you build an application from modules. Each module is stylable with Liquid Markup. And modules communicate with the rest of the aplication through events and through shared getter and setter properties.

The philosophy behind Glue is simplicity and it's right there in the name: It's about building modular apps with HTML, CSS, Liquid -- and glueing them together with as little JavaScript logic as possible.

There are a number of JavaScript frameworks designed for application development out there: SproutCore, Ember, Backbone are just a few examples. The learning curves of these libraries are pretty steep though, mostly due to the very wide scope of features -- counting complex object types and inheritance, offline sync and persistency and other awesomeness as a part of their mission. 

Glue is much less ambitious: We want to bootstrap modules, have those communicate in a simple fashion, and to use a well-documented templating language to build views.

Moreover, the usual batch of application frameworks are made to build complex applications. This makes for a good amount of flexibility, but also for untouchable code and design. 

Glue was originally built to let people modify existing video players and mobile applications, so a key requirement was to create something which could be meddled with. This is why the starting point for Glue is HTML and Liquid templates. And then you build upon that.

# Modules
Glue modules are simple to the point of being stupid: Each module is just a piece of middleware which listens to events and posts some of its own. It exchanges information with templates and other modules through getters and setters. And it optionally has its own Liquid templates, CSS styles and design assets. 

Glue bootstraps the application by loading a single module and it's template. This template in turn loads all the other modules. Such a template can look like this to load a `core`, an `analytics` and an `info` module (with an overloaded property):

    {% module core %}
    {% module analytics %}	
    <div id="info">
      {% module info with "showDescription":true %}
    </div>

A module starts out with a piece of boilerplate JavaScript. For example if the project name is `Player` and you're building a module to show a title and a description within the player (in `src/info/info.js`)

    Player.provide('info', 
      {showDescription: true}, 
      function(Player,$,opts){
          var $this = this;
          $.extend($this, opts);
          $this.render();

          return $this;
      }
    );

This will load up the module, create a container for it within the application -- and every time `.render()` is called on the module object, the standard template for the module (`src/info/info.liquid`) is processed and placed in to the document. This could be:

    <h1 class="info-title">{{title}}</div>
    {% if showDescription == true %}
        <p class="info-description">{{description}}</p>
    {% endif %}

If a module is only JavaScript logic as has no template, simply `delete` the module container when loading the module:
    
    Player.provide('analytics', 
      {}, 
      function(Player,$,opts){
          var $this = this;
          $.extend($this, opts);
          delete $this.container;

          return $this;
      }
    );

# Properties with Getters and Setters
Each module interacts with other parts of the application through properties. These are defined as getters and setters on the module, which is turn can be access by both liquid templates and in JavaScript. In the examples above we saw a few examples of such properties:

    Player.getter('showDescription', function(){
        return $this.showDescription;
      });
    Player.setter('showDescription', function(sd){
        $this.showDescription = sd;
        // Update the template contents after updating the value
        $this.render(); 
      });
    Player.getter('title', function(){
        return "A good title for the element";
      });
    Player.getter('description', function(){
        return "A similarly good description for the element";
      });

Now, other parts of the application can read titles and descriptions:

    Player.get('title');
    Player.get('description');
    
These are also available in Liquid form:

    {% if description != empty %}
      <p>{{description}}</p>
    {% endif %}
    
And if you want to change the preference for showing a description, this is done easily as well:

    Player.set('showDescription', false);

In all these cases, `.get()` and `.set()` just invoke JavaScript functions, so extra logic such a template re-rendering is easily done.

# Events
The other core concept for interaction between different parts of the application is events. All modules can invoke their own events and listen to those of others. Similarly, templates can invoke events of their own.

An event listener can have any name, but for clarity it's usually nice to namespace it a bit. For example, we could fire an event every time a title is updated:

    Player.setter('info', function(i){
        $this.info = i;
        Player.fire('player:info:updated', $this.info);
      });

And in turn another module could listen to the event:

	Player.bind('player:info:updated', function(i){
		console.log('Info was updated', i);
	  });

The Glue library itself fires two different events: 

* On initilization, it sends `glue:init`.
* When a module is added to the DOM, `glue:added` is fired.
* Every time a template has been (re-)rendered, `glue:render` is fired.

# Liquid Templates
Module templates are a combination of HTML and Liquid Markup. Liquid is a safe HTML markup language, originally [developed for Rails and Shopify](http://liquidmarkup.org/) -- but also used to customize our own [23 Video](http://help.23video.com/customer/portal/articles/586745-introduction-to-liquid). It makes it easy for designers to build conditional templates and to build designs using variables. 

Any getter property from any module is available to liquid templates (as we also saw above):

    {% if description != empty %}
      <p>{{description}}</p>
    {% endif %}

Additionally, there's a bit of extra magical markup that allow events to fire and properties to be set from liquid templates:

    <button click="$set:showDescription:true">Show description</button>
	<button click="$set:showDescription:false">Hide description</button>
	<button enter="$fire:player:button:mouseenter" 
	  leave="$fire:player:button:mouseleave">
	    A different button
	 </button>

Any HTML element can use `click`, `enter` and `leave` as properties -- and `$set:variableName:value` will set a property while `$fire:eventName` will fire off an event. You can also use `$toggle:variableName` to toggle a boolean.

Each Glue module will usually have a single liquid template attached to it, but as we saw above there are cases where a module won't have a template -- and you can even have multiple templates for a module as well.

The default template (in `src/moduleName/moduleName.liquid`) is rendered by a module with:

    $this.render();

The `.render()` function takes a few optional argument to allow for further flexibility. First, you can specific a callback to be run after every rendering. For example to listen for events on the liquid container:

    $this.render(function(){
    	$this.container.find('button').click(function(){
    	    // Do stuff when clicking a button
    	  });
      });

The second and third argument (`templatePath` and `container`) are used to render templates other than the default into a DOM object:

    $this.render(function(){}, 'info/info-button.liquid', 
      $container.find('.button-container'));

# Animations

Glue uses to [jQuery's `$.animate(...)`](http://api.jquery.com/animate/) to add simple animations on rendering. Modules can add preferences for how content is animated in when going from an empty template to one with content -- and of course the other way around:

    $this.showAnimation = [animationProperties, duration];
    $this.hideAnimation = [animationProperties, duration];

For example:

    $this.showAnimation = [{opacity:'show', height:'show'}, 300];
    $this.hideAnimation = [{opacity:'hide', height:'hide'}, 200];

Notice that Glue won't animate content changes in the rendered template; only changes from nothing to something and the reverse are animated.

# Keyboard shortcuts

Glue ships with simple support for keyboard shortcuts. Shortcuts can be attached to a property setter:

    Builder.setter('nextTab, function(){
      $this.jumpToTab($this.tab+1);
    }, ['ctrl','right']);

    Builder.setter('previousTab, function(){
      $this.jumpToTab($this.tab-1);
    }, ['ctrl','left']);

You can attach multiple shortcuts, and the actual shortcut being used will be used as the setter value:

    Builder.setter('jumpToTabFile', function(num){
      // This might be something like ['ctrl','3']
      num = (num.length ? new Number(num[1]) : num);
      $this.jumpToTab(num);
    }, [['ctrl','1'], ['ctrl','2'], ['ctrl','3']]);

Apart from standard keys you can use the following key modifiers: `backspace`, `tab`, `enter`, `pause`, `capslock`, `esc`, `space`, `pageup`, `pagedown`, `end`, `home`, `left`, `up`, `right`, `down`, `insert`, `delete`, `f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`, `f11` and `f12`.

# Internationalization

You can make your application accessible in multiple languages and serve the application to your users in a specified or automatically detected language. Say you have a module template looking like this:

    <p><a href="/competition">Click here</a> to enter the competition.</p>

This template can be be internationalized in two steps:

1. Use your application object's `translate` method to register each piece of text as a lookup key and an object of translations:

    App.translate("click_here",{
        en: "Click here",
        da: "Klik her"
    });
    App.translate("to_enter",{
        en: "to enter the competition.",
        da: "for at deltage i konkurrencen."
    });

2. Replace the text strings in your template with the lookup keys that you defined in step 1, and apply the `translate` filter on each of them:

    <p><a href="/competition">{{"click_here"|translate}}</a> {{"to_enter"|translate}}</p>

From here, your application will automatically search for the lookup keys in the internal dictionary and insert the corresponding translation.

Please note that if your are manipulating the DOM directly (as opposed to rendering module templates), you have access to the same functionality. Simply call the `translate` method with a lookup key as the single argument, and the corresponding translation will be returned:

    $("#headline").html( App.translate("my_headline_text") );

When the application searches for translations, it will try to detect the user's preferred language as determined by the settings in the user's browser. If no translation for that language is found for a key, it will fall back to searching for a translation in the default language (English). You can change which language should be used as default by calling the `setDefaultLocale` method:

    // Set the default language to Danish
    App.setDefaultLocale("da");

If you do not want your application to automatically detect the language of your users, you can overwrite this behaviour by manually specifying a locale:

    // Set language to Danish and ignore the automatically detected language
    App.setLocale("da");

To ensure cross-browser compatibility, the language keys available are limited to the two-letter primary language subtags as defined in <a href="http://tools.ietf.org/html/rfc4646#section-2.2.1">RFC 4646</a>.
When the language changes (either through `setLocale` or through automatic detection), the event `glue:localechange` is fired, and you can bind event listeners to this event if you have modules that need to be re-rendered when the language changes.

# Building the application with manifests

A final core premise of Glue is that all modules, liquid files, stylesheets and design assets must be distributable in a optimized fashion. This is why Glue ships with a build script to generate both the development version and a minified and optimized version of the application. The flow around this is pretty simple: Set up a manifest file for the application and run the build script.

A manifest file is a piece of JSON specifying the glue version, its object names, all dependencies and all the require modules. For examples:

    {
      "glueVersion":"1",
      "name":"player",
      "object":"Player",
      "bootstrapModule":"design",

      "glueLocation": "../glue/",
      "dependencies": [
        "http://www.example.com/swfobject/swfobject.js",
        "../eingebaut/eingebaut.js",
        "../visualplatform.js/visualplatform.js"
      ],

      "modules": [
        "design",
        "core",
        "analytics",
        "info",
      ]
    }

In this case our application name is `player` and the core glue object is `Player. We will load a few dependencies from either local files or URLs. The bootstrap module is `design` — and `design`, `core`, `analytics` and `info` will all be available to load.

To build the application, place all modules in folder with `src/` and then run:
 
     ../glue/build.tcl manifest.json

This in turn will create a new file called `src/player.html` for development and a full folder (`dist/`) with minified assets and design files. 

The automatically generated version will include any CSS files included in the module folder, so if you have a `src/info/info.css` file it will be referenced with a `<link rel="stylesheet" href=info/info.css" type="text/css" />` in the development version. In the distribution version, the stylesheet will be minified and nicely placed in a single file.

This method make for a rapid deployment process with optimized code, but it will also host files in different folders depending on whether it's a development or distribution version. For this reason, always reference local files is stylesheets:

    .info-icon {background-image:url('info-png.png');}

And when you reference asset files in liquid, use `{{module.path}}` as a prefix:

    <img src="{{module.path}}info-icon.png" />

# Interfacing with your Glue application with GlueFrame
If you are embedding your application on a website and want to communicate with it, eg. call the application's getters and setters or add event listeners to events being fired inside the application, you can use <a href="http://github.com/23/GlueFrame">GlueFrame</a>. This library acts as a wrapper around the iframe that your application is embedded in and provides an event based interface for getting/setting properties and binding/firing events in your application:

    <iframe src="http://example.com/app.html" id="myApp"></iframe>

    <script type="text/javascript">
      var myApp = new GlueFrame( document.getElementById("myApp"), "Player" );
      myApp.set("playing", true);
    </script>

GlueFrame accesses methods and properties in your application directly when the iframe and the page it is embedded on have the same protocol, domain and port. If not, messages are passed between the parent and child windows with `window.postMessage`.

GlueFrame works in IE8 and all modern browsers, and if your application is embedded on a page with the same protocol, domain and port, IE7 is supported too.

Read the full documentation of GlueFrame on <a href="http://github.com/23/GlueFrame">http://github.com/23/GlueFrame</a>.
    
# Examples and Dependencies
Glue was originally designed by [23](http://www.23company.com) as a foundation for building custom video players. The [repository for these players](https://github.com/23/player) serves as a good example of Glue in practice.

Glue is built on top of [jQuery](http://jquery.com/) and [Liquid.js](https://github.com/darthapo/liquid.js), although for the latter we use [our own fork](https://github.com/23/liquid.js) by default.
