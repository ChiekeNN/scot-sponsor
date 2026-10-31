export const trackerStages: string[];
export function trackerStats(applications: {stage:string; followUp:string}[], today:string): {total:number; due:number; inProgress:number; stages:Record<string,number>};
