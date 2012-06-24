# glue
A deliberately simple JavaScript application and middleware framework built on top of Liquid.js and jQuery.


## Notes for motivation and explanation
Learning curve of sproutcore, backbone, ember too high not because not well designed, they are, but because of scope -- too many features, offline sync, persistency, recursion. 

Meant for untouchable design, we are creating stuff which is meant to be meddled with. Requires non-daunting learning curve. Starting point is liquid and HTML. Then you build upon that. 

Meant for designing awesome user experiences, but not necessarily for interactive and persistent ones. 

JavaScript Code + Liquid View + CSS Style = CVS. 

Bootstrapping is one liquid template plus the core code. All dynamic behavior comes from modules themselves being dynamic. 

Simplifying by having a flat namespace and non-discriminating middleware model for communication between modules (or glue). Every event has an object which is passed forward through the module chain and then back through it again.

Designed to be loaded in a context -- but also to have that context changed, for example by reloading query parameters and thus changing a large part of the application. 

Designed for individual modules to be changeable while maintaining the overall integrity. 

## Reference

Include

    {% glue video %}
    {% glue video with "className":"my-video" %}
    {% glue video with "className":"my-video", "autoPlay":true %}
    {% glue logo with "showLogo":true, "logoAlpha":0.6 %}
