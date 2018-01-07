/**
 * When the user changes the language via the language drop down, redirect the user to the relevant translation.
 */
(function() {
    var chooser = document.getElementById('language-chooser-select');
    chooser.onchange = function() {
        var lang = this.value;
        var activeLang = 'en';
        var pageUrl = '/';

        /*
         * If we are already on "/fr" and select "ES", we don't want to redirect to "/fr/es".
         * The apache docs website achieves this via AliasMatch in their apache config, but that
         * is not able to go into the .htaccess file and so makes the deployment of the site more
         * difficult. This solves the problem in JavaScript.
         */
        if (new RegExp('^' + activeLang + '/').test(pageUrl)) {
            pageUrl = pageUrl.substring(activeLang.length + 1);
        }

        document.location = '' + '/' + lang + pageUrl;
    }
})();