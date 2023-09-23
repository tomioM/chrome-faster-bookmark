var categoryNodes = [];
var wrapper;
var focusedElement;
var fuzzySearch;
var currentNodeCount = 0;
var isNameExposed = false;
var nameFieldElement = document.getElementById("name-field");
// name suffix is removed by default when name is not exposed; however, when the name is exposed the suffix is selected (highlighted)
const namePrefixRegex = /( -| –| —|:| \|)(?!.*( -| –| —|:| \|)).*/;
const notificationSuffixRegex = /^\(\d+\)/;




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
  el.classList.add("folder");
  el.classList.add("create");
  el.innerHTML = chrome.i18n.getMessage("new") + "<em>create:</em> " + categoryName;

  wrapper.appendChild(el);
  currentNodeCount = currentNodeCount + 1;

}

function wrapSubstringWithSpan(string, substrings, className) {
  if (string) {
    let text = string;

    substrings.forEach(substring => {
      if (substring) {
        text = text.replace(substring, `<span class="${className}">${substring}</span>`);
      }
    })

    return text;
  } else {
    return string;
  }
}

function matchNameSuffix(inputString) {
  // Use the regex pattern to match text within the input
  const match = inputString.match(namePrefixRegex);

  if (match) return match;
  else return '';
}

function matchNotificationPrefix(inputString) {
  // Use the regex pattern to match text within the input
  console.log(inputString)
  const match = inputString.match(notificationSuffixRegex);
  
  if (match) return match;
  else return '';
}

function stripBookmarkName(inputString) {
  // Use the replace method to remove the matched pattern
  let strippedString = inputString;

  strippedString = strippedString.replace(notificationSuffixRegex, '');

  if (!isNameExposed) strippedString = strippedString.replace(namePrefixRegex, '');

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

function updateNameTitleAttribute() {
  console.log('update title')
  const inputValue = nameFieldElement.value;
  nameFieldElement.setAttribute('title', `Name\n${inputValue}`);
}

(function() {

  var searchElements = document.querySelectorAll("input");
  var namePreviewElement = document.querySelector("#name-preview");
  var text = "";
  var newNodes;
  var index = 0;

  // Create name preview element and use both regex strings to indicate the omission of characters
  getCurrentUrlData((url, title) => {
    let highlightedHTML = title

    highlightedHTML = wrapSubstringWithSpan(highlightedHTML, [ 
      matchNameSuffix(highlightedHTML)[0],
      matchNotificationPrefix(highlightedHTML)[0]
    ], 'omitted');

    namePreviewElement.innerHTML = highlightedHTML;
  })

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
            nameFieldElement.scrollLeft = nameFieldElement.scrollWidth;
          }
        } else {
          exposeName();
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

  nameFieldElement.addEventListener('input', updateNameTitleAttribute);

  searchElements[1].focus();

  namePreviewElement.addEventListener("click", exposeName);

  function exposeName() {
    isNameExposed = true;
    nameFieldElement.style.display = 'block';
    namePreviewElement.style.display = 'none';
    getCurrentUrlData((url, title) => {
      let strippedName = stripBookmarkName(title);

      const match = matchNameSuffix(strippedName);

      nameFieldElement.value = strippedName;

      // Selects (highlights) the portion of the string that is often removed.
      if (match) nameFieldElement.setSelectionRange(match.index, match.index + match[0].length);

      nameFieldElement.scrollLeft = nameFieldElement.scrollWidth;

      nameFieldElement.focus();
      updateNameTitleAttribute();
    });
  }

})();