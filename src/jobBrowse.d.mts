export type BrowseKind = 'industry' | 'popular' | 'location';
export type BrowseSelection = {kind:BrowseKind;id:string};
export type BrowseItem = {id:string;label:string;terms:string[];includeExcerpt:boolean;titleTerms:string[]};
export const browseGroups: Record<BrowseKind,BrowseItem[]>;
export function getBrowseItem(selection:BrowseSelection|null):BrowseItem|null;
export function matchesBrowse(job:{title:string;location:string;description?:string},selection:BrowseSelection|null):boolean;
export function browseHref(selection:BrowseSelection):string;
export function browseFromSearch(search:string):BrowseSelection|null;
export function clearBrowseUrl(href:string):string;
