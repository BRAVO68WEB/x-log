// ActivityStreams / ActivityPub type definitions (W3C standard)
// https://www.w3.org/TR/activitystreams-core/

export type IRI = string;

// 5.1 Core Type Properties
export interface CoreObject {
 id?: IRI;
 type?: string | string[];
 name?: string | { type: "langString"; languageTag: string; value: string }[];
 summary?: string | null;
 content?: string | null;
 mediaType?: string;
 url?: IRI | Link;
 published?: string; // ISO 8601 datetime
 updated?: string;
 attributedTo?: Actor | IRI | Link[];
 tags?: Object[];
 sensitivity?: string;
}

// 5.2 Actors
export interface Actor extends CoreObject {
 inbox: IRI;
 outbox: IRI;
 followers?: IRI;
 following?: IRI;
 liked?: IRI;
 preferredUsername?: string;
 name?: string;
 summary?: string | null;
 icon?: Image | Link;
 image?: Image | Link;
 endpoints?: {
 sharedInbox?: IRI;
 [key: string]: unknown;
 };
 publicKey?: {
 id: IRI;
 owner: IRI;
 publicKeyPem: string;
 };
}

export interface Person extends Actor {
 type: "Person";
}

export interface Service extends Actor {
 type: "Service";
}

export interface Application extends Actor {
 type: "Application";
}

export interface Group extends Actor {
 type: "Group";
}

// 5.3 Activity Types
export interface Activity extends CoreObject {
 actor?: Actor | IRI | Link;
 object?: Object | IRI | Link;
 target?: Object | IRI | Link;
 result?: Object | IRI | Link;
 origin?: Object | IRI | Link;
 instrument?: Object | IRI | Link;
}

export interface Accept extends Activity {
 type: "Accept";
}

export interface Add extends Activity {
 type: "Add";
}

export interface Announce extends Activity {
 type: "Announce"; // Boost
}

export interface Create extends Activity {
 type: "Create";
}

export interface Delete extends Activity {
 type: "Delete";
}

export interface Follow extends Activity {
 type: "Follow";
}

export interface Ignore extends Activity {
 type: "Ignore";
}

export interface Like extends Activity {
 type: "Like";
}

export interface Move extends Activity {
 type: "Move";
}

export interface Reject extends Activity {
 type: "Reject";
}

export interface Remove extends Activity {
 type: "Remove";
}

export interface Undo extends Activity {
 type: "Undo";
}

export interface Update extends Activity {
 type: "Update";
}

// 5.5 Object Types
export interface Article extends CoreObject {
 type: "Article";
}

export interface Note extends CoreObject {
 type: "Note";
}

export interface Document extends CoreObject {
 type: "Document";
}

export interface Image extends CoreObject {
 type: "Image";
}

export interface Video extends CoreObject {
 type: "Video";
}

export interface Audio extends CoreObject {
 type: "Audio";
}

export interface Page extends CoreObject {
 type: "Page";
}

export interface Event extends CoreObject {
 type: "Event";
}

// 6.2 Addressing
export interface Context {
 to?: IRI | Link[];
 cc?: IRI | Link[];
 bto?: IRI | Link[];
 bcc?: IRI | Link[];
 audience?: IRI | Link[];
}

// Link
export interface Link {
 type: "Link";
 href: IRI;
 rel?: string;
 mediaType?: string;
 name?: string;
}

// 7.1 Collections
export interface Collection extends CoreObject {
 totalItems?: number;
 current?: IRI | OrderedCollection | CollectionPage;
 first?: IRI | OrderedCollection | CollectionPage;
 last?: IRI | OrderedCollection | CollectionPage;
 items?: (IRI | Link | Object)[];
}

export interface OrderedCollection extends CoreObject {
 totalItems?: number;
 current?: IRI | OrderedCollectionPage;
 first?: IRI | OrderedCollectionPage;
 last?: IRI | OrderedCollectionPage;
 orderedItems?: (IRI | Link | Object)[];
}

export interface CollectionPage extends Collection {
 partOf?: IRI;
 next?: IRI;
 prev?: IRI;
}

export interface OrderedCollectionPage extends OrderedCollection {
 partOf?: IRI;
 next?: IRI;
 prev?: IRI;
 startIndex?: number;
}

// Union type for all Activity types
export type ActivityType =
 | Accept | Add | Announce | Create | Delete | Follow
 | Ignore | Like | Move | Reject | Remove | Undo | Update;

// Union type for all Object types
export type ObjectType =
 | Actor | Article | Note | Document | Image | Video
 | Audio | Page | Event | Collection | OrderedCollection;

// Activity with address fields
export interface AddressedActivity extends Activity, Context {}

// Parsed incoming activity (from JSON)
export interface InboxActivity {
 id?: string;
 type: string | string[];
 actor: string | Actor | Link;
 object: string | Object | Activity | Link;
 published?: string;
 [key: string]: unknown;
}

// Actor info extracted from a remote actor document
export interface RemoteActorInfo {
 actorUrl: string;
 username: string;
 domain: string;
 displayName?: string;
 bio?: string;
 inboxUrl: string;
 sharedInboxUrl?: string;
 publicKeyPem?: string;
 iconUrl?: string;
}