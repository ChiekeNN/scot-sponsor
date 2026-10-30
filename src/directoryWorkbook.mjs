import { getOrderOfSiblings, insertElementMarkupAccordingToOrderOfSiblings } from 'write-excel-file/utility';

export const directoryColumns = [
  { key: 'organisation_name', label: 'Organisation name', width: 36 }, { key: 'city_town', label: 'City / town', width: 22 },
  { key: 'county_region', label: 'County / region', width: 23 }, { key: 'industry_sector', label: 'Industry sector', width: 34 },
  { key: 'visa_route', label: 'Visa route', width: 35 }, { key: 'licence_rating', label: 'Licence type & rating', width: 31 },
];
export function directorySheet(rows) {
  return [directoryColumns.map(col => ({ value: col.label, type: String, fontWeight: 'bold', backgroundColor: '#DDECF1' })), ...rows.map(row => directoryColumns.map(col => ({ value: row[col.key] || '', type: String })))];
}
// Add native Excel filter arrows in the correct OOXML element order.
export function directoryAutoFilter(recordCount) {
  return { files: { transform: { 'xl/worksheets/sheet{id}.xml': { transform(xml) {
    const order = getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet');
    if (!order) throw new Error('Unable to create Excel filters.');
    return insertElementMarkupAccordingToOrderOfSiblings(xml, `<autoFilter ref="A1:F${recordCount + 1}"/>`, order, 'worksheet');
  } } } } };
}
