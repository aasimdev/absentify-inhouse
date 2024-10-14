import type { Worksheet } from 'excel4node';

export function fillWorksheet(ws: Worksheet, schema: any[], data: any) {
  let headingColumnIndex = 1;
  const columnWidths: number[] = schema.map(() => 0); // Initialize the array for saving the column widths

  // Fill the headers and determine the maximum width
  schema.forEach((schemaItem, index) => {
    const headerValue = schemaItem.column;
    ws.cell(1, headingColumnIndex++).string(headerValue);
    columnWidths[index] = Math.max(columnWidths[index] ?? 0, headerValue.length);
  });

  let rowIndex = 2;
  data.forEach((item: any) => {
    for (let index = 0; index < schema.length; index++) {
      const schemaItem = schema[index];
      const val = schemaItem.value(item);
      let cellValue = '';

      switch (schemaItem.type) {
        case String:
          cellValue = val ? `${val}` : '';
          ws.cell(rowIndex, index + 1).string(cellValue);
          break;

        case Boolean:
          const boolValue = val ? val : false;
          ws.cell(rowIndex, index + 1).bool(boolValue);
          cellValue = boolValue.toString();
          break;

        case Date:
          const dateValue = val ? new Date(`${val}`) : '';
          if (dateValue) {
            ws.cell(rowIndex, index + 1).date(dateValue);
            cellValue = dateValue.toISOString();
          } else {
            ws.cell(rowIndex, index + 1).string('');
          }
          break;

        case Number:
          const numValue = val ? parseFloat(`${val}`) : 0;
          ws.cell(rowIndex, index + 1).number(numValue);
          cellValue = numValue.toString();
          break;

        default:
          ws.cell(rowIndex, index + 1).string('');
          cellValue = '';
          break;
      }

      // Update the maximum width
      columnWidths[index] = Math.max(columnWidths[index] ?? 0, cellValue.length);

      if (schemaItem.format) {
        ws.cell(rowIndex, index + 1).style({ numberFormat: schemaItem.format });
      }
    }

    rowIndex++;
  });

  // Set the column widths
  columnWidths.forEach((width, index) => {
    ws.column(index + 1).setWidth(width);
  });
}
