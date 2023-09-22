var categoryNodes = [];
var wrapper;
var focusedElement;
var fuzzySearch;
var currentNodeCount = 0;
var isNameExposed = false;
var nameFieldElement = document.getElementById("name-field");


var DOWN_KEYCODE = 40;
var UP_KEYCODE = 38;
var CONFIRM_KEYCODE = 13;

// Filter function is the create tree function
function filterRecursively(nodeArray, childrenProperty, filterFn, results) {

  // console.log(nodeArray);
  results = results || [];

  nodeArray.forEach( function( node ) {
    if (filterFn(node)) results.push( node );
    if (node.children) filterRecursively(node.children, childrenProperty, filterFn, results);
  });

  return results;

};

function createUiElement(node) {

  var el = document.createElement("span");
  el.setAttribute("data-id", node.id);
  el.setAttribute("class", "folder");
  el.setAttribute("data-count", node.children.length);
  el.setAttribute("data-title", node.title);
  el.innerHTML = node.title;

  return el;

}

function triggerClick(element) {

  var categoryId = element.getAttribute("data-id");
  var newCategoryTitle;

  if (categoryId == "NEW") {

    if(confirm("Do you want to create a new folder?")) {
      newCategoryTitle = element.getAttribute("data-title");

      chrome.bookmarks.create({
        title: newCategoryTitle
      }, function(res) {
        processBookmark(res.id);
      })
    } else {
      var searchElement = document.getElementById("search");
      searchElement.focus();
    }

  } else {

    processBookmark(categoryId);

  }

}

function processBookmark(categoryId) {

  getCurrentUrlData(function(url, title) {


    if (title && categoryId && url) {
      if (isNameExposed) {
        const editedTitle = nameFieldElement.value
        addBookmarkToCategory(categoryId, editedTitle, url);
      } else {
        addBookmarkToCategory(categoryId, stripBookmarkName(title), url);
      }
      window.close();
    }

  });

}

function addBookmarkToCategory(categoryId, title, url) {

  chrome.bookmarks.create({
    'parentId': categoryId,
    'title': title,
    'url': url
  });

}

function getCurrentUrlData(callbackFn) {

  chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
    callbackFn(tabs[0].url, tabs[0].title)
  });

}

function createUiFromNodes( categoryNodes ) {

  var categoryUiElements = [];
  currentNodeCount = categoryNodes.length;
  // console.log(categoryNodes);

  categoryNodes.forEach( function( node ) {
    categoryUiElements.push( createUiElement(node) );
  })

  categoryUiElements.forEach( function( element ) {
    wrapper.appendChild( element );
  });

};

function resetUi() {

  wrapper.innerHTML = "";

};

function focusItem(index) {

  if (focusedElement) focusedElement.classList.remove("focus");
  focusedElement = wrapper.childNodes[index];
  focusedElement.classList.add("focus");

  focusedElement.scrollIntoView(false);

}

function addCreateCategoryButton(categoryName) {

  var el = document.createElement("span");
  el.setAttribute("data-id", "NEW");
  el.setAttribute("data-title", categoryName);
  el.classList.add("create");
  el.innerHTML = chrome.i18n.getMessage("new") + "<em>create:</em> " + categoryName;

  wrapper.appendChild(el);
  currentNodeCount = currentNodeCount + 1;

}

function stripBookmarkName(inputString) {
  // Define a regular expression pattern to match '(n)' at the beginning of the string
  const notificationSuffixRegex = /^\(\d+\)/;
  const finalHyphenRegex = /-[^-]*/;

  // Use the replace method to remove the matched pattern
  let strippedString;

  strippedString = inputString.replace(notificationSuffixRegex, '');

  strippedString = strippedString.replace(finalHyphenRegex, '');

  strippedString = strippedString.trim();

  return strippedString;
}

function createInitialTree() {

  chrome.bookmarks.getTree( function(t) {

    wrapper = document.getElementById("wrapper");

    var options = {
      keys: ['title'],
      threshold: 0.4
    }
    
    categoryNodes = filterRecursively(t, "children", function(node) {
      return !node.url && node.id > 0;
    })

    categoryNodes.sort(function(a, b) {
      return (b.dateGroupModified || b.dateAdded || 0) - (a.dateGroupModified || a.dateAdded || 0);
    });

    createUiFromNodes( categoryNodes );

    //wrapper.style.width = wrapper.clientWidth + "px";

    if (currentNodeCount > 0) focusItem(0);

    fuzzySearch = new Fuse(categoryNodes, options);

    wrapper.addEventListener("click", function(e) {
      triggerClick(e.target);
    })

  });

}

// Function to recursively flatten the bookmark tree
function flattenBookmarkTree(treeNode) {
  const flattenedNodes = [];

  function flatten(node) {
    if (!node.url) {
      flattenedNodes.push(node);
      if (node.children) {
        for (const childNode of node.children) {
          flatten(childNode);
        }
      }
    }
  }

  flatten(treeNode[0]);
  return flattenedNodes;
}

(function() {

  var searchElements = document.querySelectorAll("input");
  var text = "";
  var newNodes;
  var index = 0;

  createInitialTree();

  searchElements.forEach(searchElement => {
    searchElement.addEventListener("keydown", function(e) {

      if (e.keyCode == UP_KEYCODE) {
        e.preventDefault();
        index = index - 1;
        if (index < 0) index = currentNodeCount - 1;
        focusItem(index);
  
      } else if (e.keyCode == DOWN_KEYCODE) {
        e.preventDefault();
        index = index + 1;
        if (index >= currentNodeCount) index = 0;
        focusItem(index);
  
      } else if (e.shiftKey && e.key == 'Enter') {
        e.preventDefault();
        if (isNameExposed) {
          const activeElement = document.activeElement;
          if (activeElement == searchElements[1]) {
            searchElements[0].focus();
          } else {
            searchElements[1].focus();
          }
        } else {
          isNameExposed = true;
          nameFieldElement.style.display = 'block';
          nameFieldElement.focus();
          getCurrentUrlData((url, title) => {nameFieldElement.value = stripBookmarkName(title)});
        }
  
      } else if (e.keyCode == CONFIRM_KEYCODE) {
        if (currentNodeCount > 0) triggerClick(focusedElement);
      
      } else {
        // to get updated input value, we need to schedule it to the next tick
        setTimeout( function() {
          text = document.getElementById("search").value;
          if (text.length) {
            newNodes = fuzzySearch.search(text);
            resetUi(); 
            createUiFromNodes(newNodes) 
            if (newNodes.length) focusItem(0);
  
            if (!newNodes.length || text !== newNodes[0].title) {
              addCreateCategoryButton(text);
            }
  
            // focus new node option without user action
            console.log(!newNodes.length);
            if (!newNodes.length) {
              focusItem(0);
            }
  
  
          } else {
            resetUi();
            createUiFromNodes(categoryNodes);
            if (currentNodeCount > 0) focusItem(0);
          }
          index = 0;
        }, 0);
      }
  
    })
  })


  searchElements[0].focus();

})();