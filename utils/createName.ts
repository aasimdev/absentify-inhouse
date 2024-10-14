import { NullableOption } from '@microsoft/microsoft-graph-types';
import { DisplayNameFormat } from '@prisma/client';

export function createName(
  displayFormat: DisplayNameFormat | undefined,
  firstName: NullableOption<string> | undefined,
  lastName: NullableOption<string> | undefined,
  displayName: NullableOption<string> | undefined,
  email: string
): string {
  if (!displayFormat) displayFormat = DisplayNameFormat.Microsoft_DisplayName;
  firstName =firstName?.trim();
  lastName = lastName?.trim();
  displayName = displayName?.trim();
  email = email.trim();

  if (displayFormat === DisplayNameFormat.Microsoft_DisplayName) {
    if (displayName && displayName !== '') return displayName;
    if (firstName && firstName !== '' && lastName && lastName !== '') {
      return firstName + ' ' + lastName;
    }
    return email; 
  } 
  else if (displayFormat === DisplayNameFormat.First) {
    return (firstName && firstName !== '') ? firstName : (displayName && displayName !== '') ? displayName : email;
  } 
  else if (displayFormat === DisplayNameFormat.Last) {
    return (lastName && lastName !== '') ? lastName : (displayName && displayName !== '') ? displayName : email;
  } 
  else if (displayFormat === DisplayNameFormat.FirstLast) {
    if (firstName && firstName !== '' && lastName && lastName !== '') {
      return firstName + ' ' + lastName;
    }
    return displayName && displayName !== '' ? displayName : email;
  } 
  else if (displayFormat === DisplayNameFormat.LastFirst) {
    if (firstName && firstName !== '' && lastName && lastName !== '') {
      return lastName + ' ' + firstName;
    }
    return displayName && displayName !== '' ? displayName : email;
  }

  return email;
}