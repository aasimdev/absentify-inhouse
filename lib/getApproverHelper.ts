type Approver = {
  approver_member_id: string | null;
  predecessor_request_member_approver_id: string | null;
  approver_member: {
    name: string | null;
    email: string | null;
  } | null;
};
export function getApproverValue(approvers: Approver[], index: number, field: 'name' | 'email') {
  // Sortierfunktion
  function sortApprovers(approvers: Approver[]): Approver[] {
    const items: string[] = [];
    const sortedApprovers: Approver[] = [];

    // Find the first Approver (no predecessor)
    const first = approvers.find((y) => y.predecessor_request_member_approver_id == null);
    if (first) {
      items.push(first.approver_member_id + '');
      sortedApprovers.push(first);
    }

    // Run through the remaining approvers and sort them
    while (true) {
      const next = approvers.find((y) => y.predecessor_request_member_approver_id == items[items.length - 1]);
      if (next) {
        // Prevent cyclical references
        if (sortedApprovers.includes(next)) {
          console.warn('Cyclic reference found, loop is interrupted.');
          break;
        }
        if (next.approver_member_id) items.push(next.approver_member_id + '');
        sortedApprovers.push(next);
      } else {
        // No further approvers found, end loop
        break;
      }
    }

    return sortedApprovers;
  }

  let sortedApprovers = sortApprovers(approvers);
  // If the index is greater than the number of Approvers, the last available value is returned
  while (index >= 0) {
    const approverMember = sortedApprovers[index]?.approver_member;
    if (approverMember && approverMember[field]) {
      return approverMember[field] as string;
    }
    index--; // Fallback to the previous value
  }
  return ''; // If no value was found
}
