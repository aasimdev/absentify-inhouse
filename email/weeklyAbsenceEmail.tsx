import React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  render,
  Column,
  Row,
  Button,
  Link
} from '@react-email/components';
import { format } from 'date-fns';
import { Translate } from 'next-translate';
import { AbsenceDetails } from '~/inngest/Functions/weeklyAbsenceSummaryNotification';
import { defaultImage } from './birthdayReminder';

interface WeeklyAbsenceEmailProps {
  days: Date[];
  departments: { name: string }[];
  requestsPerDay: AbsenceDetails[][];
  locale: Locale;
  date_format: string;
  company_image_url: string | null;
  language: string;
  t: Translate;
}

const WeeklyAbsenceEmail = ({
  days,
  requestsPerDay,
  locale,
  company_image_url,
  t,
  date_format,
  departments,
  language
}: WeeklyAbsenceEmailProps) => {
  const getProfileImageHtml = (member: AbsenceDetails['requester_member']) => {
    return (
      <Img
        src={
          member.has_cdn_image && member.microsoft_user_id
            ? `https://data.absentify.com/profile-pictures/${member.microsoft_user_id}_32x32.jpeg`
            : defaultImage
        }
        width="32"
        height="32"
        style={{ borderRadius: '50%' }}
        alt={member.name || 'Profile Picture'}
      />
    );
  };

  const renderRequestsForDay = (requests: AbsenceDetails[]) => {
    return requests.length > 0 ? (
      requests.map((request) => (
        <Row key={request.id} style={{ marginBottom: requests.length > 1 ? '10px' : '0px' }}>
          <Column style={{ width: '40px', paddingRight: '15px' }}>
            {getProfileImageHtml(request.requester_member)}
          </Column>
          <Column>
            <Text style={{ fontSize: '14px', margin: 0 }}>
              {request.requester_member.name} - {getLeaveTypeHtmlInline(request.leave_type)} - {request.fullday}
              {request.leave_type.name != t('Absent') &&
              request.leave_type.color != 'blue' &&
              request.status == 'PENDING'
                ? ' - (' + t('Pending') + ')'
                : ''}
            </Text>
          </Column>
        </Row>
      ))
    ) : (
      <Text style={{ color: '#6b7280' }}>{t('no-requests')}</Text>
    );
  };

  const getLeaveTypeHtmlInline = (leaveType: AbsenceDetails['leave_type']) => {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span
          style={{
            backgroundColor: leaveType.color,
            width: '12px',
            height: '12px',
            borderRadius: '4px',
            display: 'inline-block',
            marginRight: '5px',
            verticalAlign: 'middle'
          }}
        ></span>
        <span style={{ fontSize: '14px' }}>{leaveType.name}</span>
      </span>
    );
  };

  const getDateRange = () => {
    const startDate = days[0];
    const endDate = days[days.length - 1];
    if (!startDate || !endDate) {
      return '';
    }
    return `${format(startDate, date_format, { locale })} - ${format(endDate, date_format, { locale })}`;
  };

  const getCompanyLogo = (logo: string | null) => {
    return logo ? (
      <Img src={logo} width="200" style={{ display: 'block', margin: '20px auto' }} alt="Company Logo" />
    ) : (
      <Img
        src="https://img.mailinblue.com/4606254/images/content_library/original/626525ce49f0941db7458034.png"
        width="200"
        style={{ display: 'block', margin: '20px auto' }}
        alt="absentify Logo"
      />
    );
  };

  const noRequests = requestsPerDay.every((requests) => requests.length === 0);

  return render(
    <Html>
      <Head />
      <Preview>{t('weekly-absence-overview')}</Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          {/* Header Section with background */}
          <Section style={{ backgroundColor: '#6264a7', padding: '20px', textAlign: 'center' }}>
            <Text style={{ fontSize: '28px', color: '#ffffff' }}>{t('weekly-absence-summary')}</Text>
          </Section>
          {/* Date Range above the table */}
          <Section>
            <Text style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px' }}>
              {t('weekly-absence-summary-with-departments', {
                dateRange: getDateRange(),
                departments: departments.map((d) => d.name).join(', ')
              })}
            </Text>
          </Section>
          {/* No requests message */}
          {noRequests ? (
            <Section>
              <Text style={{ fontSize: '16px', textAlign: 'center' }}>
                {t('no_absences_are_planned_for_this_week')}
              </Text>
            </Section>
          ) : (
            // Table for each day
            days.map((day, index) => (
              <Section key={day.toDateString()}>
                <Row>
                  <Column style={{ width: '100px', textAlign: 'left', paddingRight: '10px' }}>
                    <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>{format(day, 'EEEE', { locale })}</Text>
                  </Column>
                  <Column>{renderRequestsForDay(requestsPerDay[index] || [])}</Column>
                </Row>
                <hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />
              </Section>
            ))
          )}

          {/* Button Section */}
          <Section style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button
              href={'https://app.absentify.com'}
              style={{
                backgroundColor: '#6264a7',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: '700',
                textDecoration: 'none',
                marginTop: '20px'
              }}
            >
              {t('view-team-overview')} →
            </Button>
          </Section>

          {/* Footer with Company Logo */}
          <Section style={{ textAlign: 'center' }}>{getCompanyLogo(company_image_url)}</Section>

          {/* Unsubscribe Notice */}
          <Section style={{ marginTop: '20px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
            <Text>
              {t('you-receive-this-email-because')} <br />
              {t('you-can-unsubscribe')} <br />
              <Link
                href={`https://app.absentify.com/api/unsubscribe/weeklyabsencesummary?language=${language}`}
                target="_blank"
                style={{ color: '#1a73e8', textDecoration: 'underline' }}
              >
                {t('unsubscribe')}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WeeklyAbsenceEmail;
