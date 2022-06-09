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
			this.store = (adapter.name != "inMemory") ? adapter({}) : false;
			if (this.store)
				this.store.collections = [/* collectionsKeys (persistent) */];
        
        /* ... */
        
		}
	}
}
