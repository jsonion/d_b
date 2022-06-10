/*

  # jsonion database – a lightweight localStorage or inMemory data store (and other adapters)

   *//*

  Local data state in general
  - local data state contains a subset of data nodes found in a centralized collection
  - a persistent, locally stored collection should contain data nodes, relevant to the user
   => user-centered collections may be defined: profile, my publications, starred items (mainly),
      where profile is a single document and my publications or starred items are arrays on 2nd level

  Use-case: Fragmented data sources and data sources with higher latency
  - maintaining local collections is a big efficiency gain when firing up a web app (available offline)
  - mapping several sources to one collection is a pain (normalizing and populating or extracting entries)
   => `jsonion-remap` package can normalize schema of various inbound query results
   => populating data entries requires traversing origin collection twice, before and after
      producing a list of data nodes from various other collections in reference
     (populating data is simply a task fulfilled by a given backend API endpoint)
	
  Persistent storage: localStorage adapter
  - localStorage allows access to data on a per-collection basis, on every read and write
  - reading and writing move an entire collection between its allocated memory blocks (diffing?)
   => idle timeout may be used to transfer data from inMemory cache to a persistent localStorage
	
  Localhost data stores (external to `document` and `window`)
  - external, local data stores may also be utilized for this purpose by employing adapters
  - filtering and sorting instructions may vary (where JavaScript predicates don't yet function)
   => d_b.store = adapter({});

  Reactive component context
  - onComponentWillMount:
    localStorage adapter delivers a persistent collection (a subset of data nodes);
  - onComponentDidMount:
    when there is insufficient results, a remote source is queried;
    when query results match a given predicate, localStorage is updated;
  - onSubmit, onUpdate:
    when device or remote source is offline, a pending transaction is stored to escrow and localStorage;
    when connected, escrow is submitted and unsuccessful transaction removed from localStorage;
  - onRemoteEvent (subscriptions, polling)
    when a change to a data node is registered at a backend API, a partial or a full data node
    is delivered to online clients that request such data by subscription, polling or a query;

  React, Redux
  - react and redux store data state in components and in a centralized data store, respectively
  - data can be fetched from remote sources and injected into the component tree or a redux store
  - react uses fiber architecture to schedule tasks to update the DOM (not revealing when it is idle)
   => a simple idle timeout is scheduled for any secondary tasks (i.e. transfering data to localStorage)
  - if a react component fetches data, it will repeat this step every time it loads anew (or in effect),
    though only after its code has been executed (as instead of before or in parallel to rendering views)
   => each component registers a syncResponder when querying for data or with subscriptions for updates,
      and these syncResponders trigger updates to displayed data state on matching predicates and offsets
     (for multiple components to effectively submit a singular query, backend API requires configuring)

  Data store adapter structure
  ... see code

  Frontend database interface as input of Fetch API/JSON deserializer (filtering and sorting collections)
  ...
  
*/

import remap from 'jsonion-remap';

export { localStorage, inMemory };
export default d_b;

var jsonionInMemoryData = { "collectionKey": [] };
var isLocalStorage = (typeof window !== 'undefined' && window.localStorage !== 'undefined');

function d_b (adapter) {
  return new jsonionDB(adapter);
}

 //
// Adapters: inMemory, localStorage, ...

function inMemory (d_b) {
  d_b.setCollection = (key, value) => {
    jsonionInMemoryData[key] = value;
    return true;
  };

  d_b.getCollection = (key) => (typeof jsonionInMemoryData[key] !== 'undefined') 
     ? jsonionInMemoryData[key] : false;

  d_b.removeCollection = (key) => delete jsonionInMemoryData[key];
  d_b.clear = () => jsonionInMemoryData = {};

  return d_b;
}

function localStorage (d_b) {
  if (!isLocalStorage)
    return inMemory(d_b);

  if (isLocalStorage) {
    d_b.setCollection = (key, value) => {
      try {
        value = JSON.stringify(value);
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        return error;
      }
    };

    d_b.getCollection = (key) => {
      try {
        var item = window.localStorage.getItem(key);
        if(item !== 'undefined')
          return JSON.parse(item);
        else
          return false;
      } catch (error) {
        return error;
      }
     };

     d_b.removeCollection = (key) => {
       try {
         window.localStorage.removeItem(key);
         return true;
       } catch (error) {
         return error;
       }
     };

     d_b.clear = () => {
       try {
         window.localStorage.clear();
         return true;
       } catch (error) {
         return error;
       }
     };
  }

  return d_b;
}


class jsonionDB {
  constructor (adapter) {
    if (typeof adapter === 'function') {
      this.memory = (adapter.name == "inMemory") ? adapter({}) : inMemory({});
      this.stores = (adapter.name != "inMemory") ? adapter({}) : false;
      if (this.stores)
        this.stores.collections = [/* collectionKeys (persistent) */];
      this.favoriteCollections = [/* collectionKeys (persistent) */];

      // //
        let collection = "d_b.TOM";
        let offset = [0, 10],
            sort = 1 || "ASC" || "asc" 
               || -1 || "DESC" || "desc" 
               || {"key": 1, "key2": -1};
        let predicate = function(){ return false; } || {"id": true || false, "match": "value"};
        let syncResponder = () => {},
            minBuffer = 3 * offset[1];
      // //

      this.offsetBufferRatio = 3;
      this.bindings = { // … (un)registering UI updating functions
        active: false,
        fns: {
          [syncResponder]: {
            [collection]: [[predicate, sort], /* ... */], // … managing syncResponders
          },
        },
        mounted: { // … inMemory
          [collection]: [
            buffer: offset[0] * this.offsetBufferRatio,
            [predicate]: { // … rows inserted or removed are matched before syncing view
              [sort]: {
                [syncResponder]: [...offset, minBuffer],
               },
             },
           ],
         },
         remote: {/* [collection]: {[fetchAPI]: () => {}}  */}, subs: {},
       };

       // Unimplemented
       this.remap = {};
       this.schema = {};
       this.indexKeys = {};
       this.augmentations = {};
	    
       /* ... */

       // Syncing data between memory and persistent storage
       this.transfers = {};
       this.idleTimer = 2500;
       this.idle = 0;
     } else
       throw "Database adapter is of invalid type";
  }

  getCollection (key) {
    if (this.memory) {
      let collection = this.memory.getCollection(key);
      if (collection && !isError(collection))
        return collection;
    }

    if (this.stores) {
      let collection = this.stores.getCollection(key);
      if (!isError(collection)) {
        if (path && collection[path])
          return collection[path];
        else
          return collection;
      }
    }

    return false;
  }

  setCollection (key, object) {
    var response = new response();

    if (this.memory)
      response.add(this.memory.setCollection(key, object));

    if (this.stores && this.stores.collections.indexOf(key) !== -1)
        this.persistCollection(key);

    return response.render();
  }

  clearMemory () {
    var response = this.memory.clear();
    return (!isError(response)) ? true : response;
  }

  clearStore (keys) {
    var response = new response();
    for (let key of keys) {
      response.add(this.stores.removeCollection(key));
    }
    return response.render();
  }
	
  // ...

  getRow (collectionKey, i, syncResponder = null) {
    /* ... */
  }

  findOne (collectionKey, predicateObj, sort = 1, syncResponder = null) {
    var offset = [0, 1];
    var result = this.find(collectionKey, predicateObj, sort, offset, syncResponder);

    if (isArray(result))
      return result[0];
    if (isObject(result))
      return result;
	  
    return result;
  }

  find (collectionKey, predicateObj, sort = 1, offset = null, syncResponder = null) {
    /* ... */
  }

  insertRows (collectionKey, dataNodes, idKey = null) {
    /* ... */
  }

  updateRow (collectionKey, dataNode, i) {
    /* ... */
  }

  update (collectionKey, dataNode, uniqueIdPredicate) {
    /* ... */
  }

  removeRow (collectionKey, i) {
    /* ... */

    collection[i] = null;

    /* ... */
  }

  // ...
	
  addSyncResponder (collectionKey, results, predicateObj, syncResponder) {
    /* ... */
  }

  removeSyncResponder (syncResponder) {
    /* ... */
  }

  unbindReactiveCollection (collectionKey) {}

  persistCollection (collectionKey) {
    if (typeof this.transfers[collectionKey] === "number")
      this.transfers[collectionKey] = this.transfers[collectionKey] + 1;

    if (!Object.keys(this.transfers).length) {
      this.idle = Date.now();
      document.addEventListener('mousemove', this.resetTimer);
      document.addEventListener('mouseup', this.resetTimer);
      document.addEventListener('scroll', this.resetTimer);
      document.addEventListener('keyup', this.resetTimer);
      this.persistTimeout();
    }
  }

  persistTimeout () {
    if (this.idle < Date.now() - this.idleTimer)
      setTimeout(this.persistTimeout, this.idleTimer);
    else {
      for (let collectionKey in Object.keys(this.transfers)) {
        if (this.idle < Date.now() - this.idleTimer) {
		
          /* ... */

        }
        else {
          setTimeout(this.persistTimeout, this.idleTimer);
          break;
        }
      }
      this.unsetTimer();
    }
  }

  resetTimer() {
    this.idle = Date.now();
  }

  unsetTimer() {
    if (Object.keys(this.transfers).length == 0) {
      document.removeEventListener('mousemove', this.resetTimer);
      document.removeEventListener('mouseup', this.resetTimer);
      document.removeEventListener('scroll', this.resetTimer);
      document.removeEventListener('keyup', this.resetTimer);
    }
  }

  // ...

  validate (schema, dataNode) {

  validationError (ident, object = null) {}

  // ...

  seedCollection (collectionKey, seedData, uniqueIdPredicate = null) {
    /* ... */
  }

  seedCollections (collectionsObj, idPredicates = ['id']) {
    /* ... */
  }
}

class response extends Error {
  constructor() {
    this.response = true;
    this.count = 0;
  }

  add (response) {
    if (isError(response) || response === false)
      this.response = (isArray(this.response)) ? this.response.push(response) : [response];
  }

  count (num) {
    this.count = this.count + num;
  }

  render() {
    if (this.response === true) {
      if (this.count)
        return this.count;
      else
        return true;
    }
    else {
      if (!this.count)
        return (this.response.length > 1) ? new Error(this.response.join(", ")) : this.response[0];
      else
        return new Error(`Success count: ${this.count}; Errors: `+this.response.join(", "));
    }
  }

  toString() {
    var result = this.render(); 
    if (result === true || typeof result === "number")
      return result;
    else
      return `${result}`;
  }
}

// ...

function findIndex (array, predicateObj) {
  return findByIndex(array, predicateObj);
}

function findLastIndex (array, predicateObj) {
  return findByIndex(array, predicateObj, true);
}

function findByIndex (array, predicateObj, reverse = false) {
  if (!isArray(array))
    return -1;

  if (isObject(predicateObj)) {
    var keys = Object.keys(predicateObj);
    if (keys.length == 0)
      return -1;
  }
  else
  if (!isFunction(predicateObj))
    return -1;

  var findIndexFn;
  if (!reverse)
    findIndexFn = array.findIndex;
  else
    findIndexFn = array.findLastIndex;

  return findIndexFn(row => {
    if (isObject(predicateObj)) {
      if (!keys.every(key => typeof row[key] !== 'undefined'))
        return false;
      if (!keys.every(key => row[key] == predicateObj[key]))
        return false;
    }
    else
    if (isFunction(predicateObj)) {
      if (!predicateObj(row))
        return false;
    }

    return true;
  });
}

function filter (array, predicateObj, sort = 1, offset = null, returnObjects = true) {
  if (!isArray(array))
    return -1;

  if (isObject(predicateObj)) {
    var keys = Object.keys(predicateObj);
    if (keys.length == 0)
      return -1;
  }
  else
  if (!isFunction(predicate))
    return -1;

  var results = [],
            i = -1;

  for (let row of array) {
    i++;
    if (isObject(predicateObj)) {
      if (keys.every(key => typeof row[key] !== 'undefined') &&
          keys.every(key => row[key] == predicateObj[key])) {
        if (returnObjects)
          results.push(row);
        else
          results.push(i);
      }
    }
    else
    if (isFunction(predicateObj)) {
      if (predicateObj(row)) {
        if (returnObjects)
          results.push(row);
        else
          results.push(i);
      }
    }
  };
}

// ...

function concat () {
  var array1 = arguments.shift();
  return array1.concat(...arguments);
}

// ...

function isObject (object) {
  if (Object.prototype.toString.call(object) === '[object Object]')
    return true;
  else
    return false;
}

function isArray (object) {
  if (Object.prototype.toString.call(object) === '[object Array]')
    return true;
  else
    return false;
}

function isFunction (object) {
  if (typeof object === "function")
    return true;
  else
    return false;
}

function isError (object) {
  if (object instanceof Error)
    return true;
  else
    return false;
}
