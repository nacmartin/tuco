/**
 * XULSchoolChrome namespace.
 */
if ("undefined" === typeof (TucoChrome)) {
  var TucoChrome = {};
}

window.addEventListener('popupshowing', TucoShowHideItems, false);

function TucoShowHideItems1(thisId){
      if (thisId.explicitOriginalTarget.id == "contentAreaContextMenu" ) {
        TucoShowHideItems("contentAreaContextMenu");}
}

function TucoShowHideItems()
{
  var element = document.popupNode;
  var isImage = (element instanceof Components.interfaces.nsIImageLoadingContent && element.currentURI);
  document.getElementById("grabImage").hidden = !isImage;
}

/**
 * Controls the browser overlay for the Hello World extension.
 */
TucoChrome.BrowserOverlay = {
  /**
   * Says 'Hello' to the user.
   */
  grabImage : function(aEvent) {
    if(gContextMenu.onImage){
      var src = document.popupNode.getAttribute('src');
      var dst;

      if (src.match(/^\//)){
        var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIWebNavigation)
                     .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindow);

        var site = mainWindow.getBrowser().selectedBrowser.contentWindow.location.href;
        var parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
        var parsed_site = parse_url.exec(site);
        if(parsed_site[4]){
          dst = parsed_site[1]+':'+parsed_site[2]+parsed_site[3]+':'+parsed_site[4]+src;
        }else{
          dst = parsed_site[1]+':'+parsed_site[2]+parsed_site[3]+src;
        }
      }else{
        dst = src;
      }
      var retVals = {'dst': dst, 'title': null, 'tags': null};
      window.openDialog( "chrome://tuco/content/detailsWindow.xul", 
        "tuco-details-window", 
        "chrome,centerscreen,dialog, modal", dst, retVals);
      if(retVals.dst){
        dst = encodeURIComponent(retVals.dst);
        title = encodeURIComponent(retVals.title);
        tags = encodeURIComponent(retVals.tags);
        request = new XMLHttpRequest();
        url2ajax ='http://localhost:3000/save/'+dst+'/'+title+'/'+tags;
        request.open("GET", url2ajax, true);
        request.send(null);
      }
    }
  },

  doOk: function() {

  },

  doCancel: function() {
  },

};
