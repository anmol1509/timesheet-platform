// Microsoft Clarity — one project for the marketing site and the staff app;
// recordings are told apart by the "area" tag the app sets.
export const CLARITY_PROJECT_ID = "yox1polsck";

/** Microsoft's loader: defines the `window.clarity` call queue, then injects the tag. */
export const CLARITY_LOADER = `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`;
