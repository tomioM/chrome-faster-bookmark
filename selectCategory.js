var categoryNodes = [];
var wrapper;
var focusedElement;
var fuzzySearch;
var currentNodeCount = 0;
var isNameExposed = false;
var isMarkedImportant = false;
var importantMarkStr = '★ ';
var importantMarkLimit = 10;
var nameElement = document.getElementById("name-field");
// name suffix is removed by default when name is not exposed; however, when the name is exposed the suffix is selected (highlighted)
const nameSuffixRegex = /( -| –| —| ●|:| \|| •)(?!.*( -| –| —| ●|:| \|| •)).*/;
const notificationPrefixRegex = /^\(\d+\)/;
const tagsRegex = / #(?![0-9])([^\s]*)/g;

const limitRegex = / \[s*<(\d+)\s*\]/;




var DOWN_KEYCODE = 40;
var UP_KEYCODE = 38;
var CONFIRM_KEYCODE = 13;

// Filter function is the create tree function
function filterRecursively(nodeArray, childrenProperty, filterFn, results, path = []) {

  // console.log(nodeArray);
  results = results || [];

  nodeArray.forEach( function( node ) {
    const currentPath = (node.id > 0) ? [...path, node.title]: [];

    if (filterFn(node) && !node.title.toLowerCase().includes('archive')) {
    results.push({
        ...node,
        path: currentPath,
        // Slightly gross solution for allowing paths to be matched in both directions
        joinedPath: currentPath.slice(1).join(' '),
        joinedPathReversed: currentPath.slice(1).reverse().join(' '),
      })
    };
    if (node.children && !node.title.toLowerCase().includes('archive')) filterRecursively(node.children, childrenProperty, filterFn, results, currentPath);
  });

  return results;
};

function createUiElement(node) {
  const parentStrings = node.path.slice(1, -1);
  const title = node.title.replace(limitRegex, "");
  const count = node.children.length;


  var el = document.createElement("span");
  el.setAttribute("data-id", node.id);
  el.setAttribute("class", "folder");
  el.setAttribute("data-title", title);
  el.setAttribute("data-count", count);
  el.setAttribute("data-path", node.path.join('/'));
  el.setAttribute("title", node.path.join(' > '));
  el.innerHTML = title;

  var parentsSpan = document.createElement("span");
  parentsSpan.setAttribute("class", "parent-details");
  parentsSpan.innerHTML = `${parentStrings.length ? '< ': ''}${parentStrings.reverse().join(' < ')}`;
  el.appendChild(parentsSpan)

  let limit = node.title.match(limitRegex)

  if (node.title.includes("★")) {
    limit = limit || [0, importantMarkLimit];
  }
  
  if (limit) {
    el.setAttribute("data-limit", limit[1]);
    const limitSpan = document.createElement("span");
    if (count >= limit[1]) {
      limitSpan.setAttribute("class", "count-chip overflow");
    } else {
      limitSpan.setAttribute("class", "count-chip");
    }
    limitSpan.innerHTML = `${count}/${limit[1]}`;
    el.appendChild(limitSpan)
  } else {
    const countSpan = document.createElement("span");
    countSpan.setAttribute("class", "count-chip unlimited");
    // el.setAttribute("data-limit", limit);

    countSpan.innerHTML = `${count}`;
    el.appendChild(countSpan)
  }
  
  return el;
}

function triggerClick(element) {

  var categoryId = element.getAttribute("data-id");
  var newCategoryTitle;

  const limit = parseInt(element.getAttribute("data-limit"));
  const count = parseInt(element.getAttribute("data-count"));

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
    if(!limit || limit > count) {
      processBookmark(categoryId);
    } else if (
      count >= limit 
      && confirm("Are you sure you want to exceed this folder's bookmark limit?")
      ) {
      processBookmark(categoryId);
    }
  }

}

function processBookmark(categoryId) {

  getCurrentUrlData(function(url, title) {


    if (title && categoryId && url) {
      if (isNameExposed) {
        const editedTitle = nameElement.value
        addBookmarkToCategory(categoryId, editedTitle, url);
      } else {
        if (isMarkedImportant) {
          addBookmarkToCategory(categoryId, importantMarkStr + stripBookmarkName(title), url);
        } else {
          addBookmarkToCategory(categoryId, stripBookmarkName(title), url);
        }
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

  categoryNodes.forEach( function( node, index ) {
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
  el.innerHTML = chrome.i18n.getMessage("new") + `<span><em>create folder:</em> ${categoryName}</span>`;

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
  const match = inputString.match(nameSuffixRegex);

  if (match) return match;
  else return '';
}

function matchNotificationPrefix(inputString) {
  // Use the regex pattern to match text within the input
  const match = inputString.match(notificationPrefixRegex);
  
  if (match) return match;
  else return '';
}

function matchTags(inputString) {
  // Use the regex pattern to match text within the input
  const match = inputString.match(tagsRegex);

  if (match) return match;
  else return '';
}

function stripBookmarkName(inputString) {
  // Use the replace method to remove the matched pattern
  let strippedString = inputString;

  strippedString = strippedString.replace(notificationPrefixRegex, '');

  strippedString = strippedString.replace(tagsRegex, '');

  if (!isNameExposed) strippedString = strippedString.replace(nameSuffixRegex, '');

  strippedString = strippedString.trim();

  return strippedString;
}

function createInitialTree() {

  chrome.bookmarks.getTree( function(t) {

    wrapper = document.getElementById("wrapper");

    var options = {
      keys: ['title', 'joinedPath', 'joinedPathReversed' ],
      threshold: 0.4,
      ignoreLocation: true
    }
    
    categoryNodes = filterRecursively(t, "children", function(node) {
      return !node.url && node.id > 0;
    })

    categoryNodes.sort(function(a, b) {
      return (b.dateGroupModified || b.dateAdded || 0) - (a.dateGroupModified || a.dateAdded || 0);
    });

    createUiFromNodes( categoryNodes );

    //wrapper.style.width = wrapper.clientWidth + "px";

    console.log(categoryNodes)
    if (currentNodeCount > 0) focusItem(0);

    console.log(categoryNodes)
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

function updateNameTitle() {
  const inputValue = nameElement.value;
  nameElement.setAttribute('title', `Name\n${inputValue}`);
}

(function() {

  var inputElements = document.querySelectorAll("input");
  var searchElement = document.querySelector('#search');
  var namePreviewElement = document.querySelector("#name-preview");
  var text = "";
  var newNodes;
  var index = 0;

  // Create name preview element and use both regex strings to indicate the omission of characters
  getCurrentUrlData((url, title) => {
    let highlightedHTML = title;

    highlightedHTML = wrapSubstringWithSpan(highlightedHTML, [ 
      matchNameSuffix(highlightedHTML)[0],
      matchNotificationPrefix(highlightedHTML)[0],
      ...matchTags(highlightedHTML)
    ], 'omitted');

    namePreviewElement.innerHTML = highlightedHTML;
  })

  document.addEventListener('keydown', function(event) {
      if (event.key === 'Control') {
          document.body.classList.add('show-counts');
          console.log("hey")
      }
  });

  document.addEventListener('keyup', function(event) {
      if (event.key === 'Control') {
          document.body.classList.remove('show-counts');
      }
  });

  inputElements[1].focus();
  createInitialTree();

  inputElements.forEach(inputElement => {
    inputElement.addEventListener("keydown", function(e) {

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
          if (activeElement == nameElement) {
            searchElement.focus();
          } else {
            nameElement.focus();
            nameElement.scrollLeft = nameElement.scrollWidth;
          }
        } else {
          exposeName();
        }
  
      } else if (e.ctrlKey && e.key == 'i') {
        if (!isMarkedImportant) {
          console.log('marking');
          if (isNameExposed) {
            inputElements[0].value = markImportant(inputElements[0].value);
          } else {
            namePreviewElement.innerHTML = markImportant(namePreviewElement.innerHTML);
          }
        } else {
          if (isNameExposed) {
            inputElements[0].value = unmarkImportant(inputElements[0].value);
          } else {
            namePreviewElement.innerHTML = unmarkImportant(namePreviewElement.innerHTML);
          }
        }
      } else if (e.keyCode == CONFIRM_KEYCODE) {
        if (currentNodeCount > 0) triggerClick(focusedElement);
      
      } else {

      }
    })
  })

  function markImportant(inputString) {
    isMarkedImportant = true;
    return importantMarkStr + inputString;
  }

  function unmarkImportant(inputString) {
    isMarkedImportant = false;
    return inputString.replace(importantMarkStr, '');
  }

  searchElement.addEventListener('input', () => {
    // to get updated input value, we need to schedule it to the next tick
    setTimeout( function() {
      text = document.getElementById("search").value;
      if (text.length) {
        newNodes = fuzzySearch.search(text);
        console.log(newNodes)
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
  });

  nameElement.addEventListener('input', updateNameTitle);

  namePreviewElement.addEventListener("click", exposeName);

  async function exposeName() {
    isNameExposed = true;
    nameElement.style.display = 'block';
    namePreviewElement.style.display = 'none';
    getCurrentUrlData((url, title) => {
      let strippedName = stripBookmarkName(title);

      if (isMarkedImportant) {
        strippedName = markImportant(strippedName);
      };

      const match = matchNameSuffix(strippedName);

      nameElement.value = strippedName;

      // Selects (highlights) the portion of the string that is often removed.
      if (match) nameElement.setSelectionRange(match.index, match.index + match[0].length);

      nameElement.scrollLeft = nameElement.scrollWidth;

      nameElement.focus();
      updateNameTitle();
    });
  }

})();