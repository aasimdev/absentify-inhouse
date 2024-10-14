import type { RequestApproverStatus, RequestStatus } from '@prisma/client';
import { ApprovalProcess } from '@prisma/client';
import { format } from 'date-fns';
import type { Translate } from 'next-translate';

export function generateRequestDetailsHtml(
  request: { start: Date; start_at: string; end: Date; end_at: string },
  t: Translate,
  date_format: string
): string {
  const translateAt = (value: string) => {
    if (value == 'afternoon') return t('Afternoon');
    if (value == 'morning') return t('Morning');
    if (value == 'lunchtime') return t('Lunchtime');
    if (value == 'end_of_day') return t('the-end-of-day');
  };
  let text = t('from-start_at-of-start-until-the-end_at-on-end', {
    start_at: translateAt(request.start_at),
    start: format(request.start, date_format),
    end_at: translateAt(request.end_at),
    end: format(request.end, date_format),
  });

  if (request.start_at == 'morning' && request.end_at == 'end_of_day') {
    if (request.start.toDateString() == request.end.toDateString()) {
      text = t('on-single-day', { start: format(request.start, date_format) });
    } else
      text = t('from-start-to-end', {
        start: format(request.start, date_format),
        end: format(request.end, date_format),
      });
  }

  return text;
}

export function generateRequestStatusHeader(
  approvalProcess: ApprovalProcess,
  approvers: { name: string; image: string; status: RequestApproverStatus }[],
  t: Translate,
  status: RequestStatus
) {
  if (status == 'APPROVED') {
    if (
      (approvalProcess == ApprovalProcess.Linear_all_have_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_all_have_to_agree) &&
      approvers.length > 1
    ) {
      return t('all-had-to-approve');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_all_have_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_all_have_to_agree) &&
      approvers.length == 1
    ) {
      return t('details');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_one_has_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_one_has_to_agree) &&
      approvers.length > 1
    ) {
      return t('one-had-to-approve');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_one_has_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_one_has_to_agree) &&
      approvers.length == 1
    ) {
      return t('details');
    }
  } else if (status == 'PENDING') {
    if (
      (approvalProcess == ApprovalProcess.Linear_all_have_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_all_have_to_agree) &&
      approvers.length > 1
    ) {
      return t('pending-all-must-approve');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_all_have_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_all_have_to_agree) &&
      approvers.length == 1
    ) {
      return t('waiting-for-approval');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_one_has_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_one_has_to_agree) &&
      approvers.length > 1
    ) {
      return t('pending-one-must-approve');
    }
    if (
      (approvalProcess == ApprovalProcess.Linear_one_has_to_agree ||
        approvalProcess == ApprovalProcess.Parallel_one_has_to_agree) &&
      approvers.length == 1
    ) {
      return t('waiting-for-approval');
    }
  }
  return '';
}
