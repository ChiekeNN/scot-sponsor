export function parseDate(value:string):Date|null;
export function weekStart(value:string):string|null;
export function weeklyHours(rows:{date:string;hours:number}[],date:string):number|null;
export function fiveYearAnniversary(value:string):string|null;
export function checkedPeriod(date:string,start:string,end:string):'within'|'outside'|'unknown';
export function encryptEvidence(file:{name:string;type:string;bytes:Uint8Array},password:string):Promise<string>;
export function decryptEvidence(packageText:string,password:string):Promise<{name:string;type:string;createdAt:string;bytes:Uint8Array}>;
