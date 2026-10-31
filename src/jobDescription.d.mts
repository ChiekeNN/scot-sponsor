export type DescriptionBlock = {type:'paragraph'|'heading';text:string}|{type:'list';items:string[]};
export function descriptionBlocks(value:string):DescriptionBlock[];
