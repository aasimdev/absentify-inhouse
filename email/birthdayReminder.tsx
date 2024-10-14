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
  Button,
  render,
  Column,
  Row
} from '@react-email/components';
import { Translate } from 'next-translate';
import { format } from 'date-fns';

type EventDetails = {
  member_id: string;
  microsoft_user_id: string | null;
  has_cdn_image: boolean;
  date: Date;
  name: string | null;
};

interface WeeklyEventEmailProps {
  birthdayEvents: EventDetails[];
  anniversaryEvents: EventDetails[];
  link: string;
  company_image_url: string | null;
  locale: Locale;
  t: Translate;
  is_admin: boolean;
  date_format: string;
}
export const defaultImage =
  'data:image/png;base64,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';

const WeeklyEventEmail = ({
  birthdayEvents,
  anniversaryEvents,
  link,
  company_image_url,
  locale,
  t,
  is_admin,
  date_format
}: WeeklyEventEmailProps) => {
  const getBirthdayText = (birthDate: Date, is_admin: boolean): string => {
    if (!is_admin) {
      return '';
    }

    const today = new Date();
    const birthYear = birthDate.getFullYear();
    const currentYear = today.getFullYear();

    // Calculate the age
    let age = currentYear - birthYear;

    // Check whether the birthday is still coming up this year or is today
    const nextBirthday = new Date(birthDate);
    nextBirthday.setFullYear(currentYear);

    return ' - ' + t('multiple-years-old', { age });
  };
  const getAnniversaryText = (startDate: Date): string => {
    const today = new Date();
    const startYear = startDate.getFullYear();
    const currentYear = today.getFullYear();

    // Calculate the years since the start date
    let years = currentYear - startYear;

    // Check whether the anniversary is in the future
    const nextAnniversary = new Date(startDate);
    nextAnniversary.setFullYear(currentYear);

    if (years === 0) {
      return ' - ' + t('first-working-day');
    } else if (years === 1) {
      return ' - ' + t('1-year-anniversary');
    } else {
      return ' - ' + t('multiple-years-anniversary', { years: years.toString() });
    }
  };
  const removeYearFromDateFormat = (formatString: string) => {
    return formatString
      .replace(/^yyyy[\s\-\/.]?/g, '') //Removes 'yyyy' at the beginning including the separator
      .replace(/[\s\-\/.]?yyyy/g, '') //Removes 'yyyy' in the middle or at the end
      .trim(); // Removes any leading or trailing spaces
  };

  const getProfileImageHtml = (event: EventDetails) => {
    return (
      <Img
        src={
          event.has_cdn_image && event.microsoft_user_id
            ? `https://data.absentify.com/profile-pictures/${event.microsoft_user_id}_64x64.jpeg`
            : defaultImage
        }
        width="64"
        height="64"
        style={{ borderRadius: '50%' }}
        alt={event.name + ''}
      />
    );
  };

  const renderEvents = (events: EventDetails[], isBirthday: boolean) => {
    const today = new Date(); // Heutiges Datum

    return events.length > 0 ? (
      events.map((event) => {
        const eventDate = new Date(event.date);

        //Set the year of the event to the current year
        eventDate.setFullYear(today.getFullYear());

        // If the event is in January and the current date is in December, set the event to next year
        if (today.getMonth() === 11 && eventDate.getMonth() === 0) {
          eventDate.setFullYear(today.getFullYear() + 1);
        }

        //Determine the day of the week or "Today" if the event day is today
        let weekday = '';
        if (eventDate.getDate() === today.getDate() && eventDate.getMonth() === today.getMonth()) {
          weekday = t('today');
        } else {
          weekday = format(eventDate, 'EEEE', { locale });
        }

        return (
          <Section key={event.member_id}>
            <Row style={{ marginBottom: '10px' }}>
              {/* profile picture */}
              <Column style={{ width: '64px', paddingRight: '10px' }}>{getProfileImageHtml(event)}</Column>

              {/* Text to the right of the picture */}
              <Column style={{ paddingLeft: '10px' }}>
                <Text style={{ fontSize: '18px', color: '#374151', margin: 0 }}>
                  {event.name} {isBirthday ? getBirthdayText(event.date, is_admin) : getAnniversaryText(event.date)}
                </Text>
                <Text style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  {weekday}, {format(eventDate, removeYearFromDateFormat(date_format), { locale })}
                </Text>
              </Column>
            </Row>
          </Section>
        );
      })
    ) : (
      <Text style={{ color: '#6b7280' }}>{t(isBirthday ? 'no-upcoming-birthdays' : 'no-upcoming-anniversaries')}</Text>
    );
  };

  const getCompanyLogo = (logo: string | null) => {
    return logo ? (
      <Img src={logo} width="200" style={{ display: 'block', margin: '20px auto' }} alt="Company Logo" />
    ) : (
      <Img
        src="https://img.mailinblue.com/4606254/images/content_library/original/626525ce49f0941db7458034.png"
        width="200"
        style={{ display: 'block', margin: '20px auto' }}
        alt="Absentify Logo"
      />
    );
  };

  return render(
    <Html>
      <Head />
      <Preview>{t('upcoming-birthdays-and-anniversaries')}</Preview>
      <Body style={{ backgroundColor: '#1f1f1f', fontFamily: 'Arial, Helvetica, sans-serif', color: '#fff' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          {/* Header Section with background */}
          <Section style={{ backgroundColor: '#6264a7', padding: '20px', textAlign: 'center' }}>
            <Text style={{ fontSize: '28px', color: '#ffffff' }}>{t('upcoming-birthdays-and-anniversaries')}</Text>
          </Section>

          {/* Birthday Events Section */}
          <Section style={{ backgroundColor: '#fff', padding: '15px', color: '#000' }}>
            <Text style={{ fontSize: '20px', color: '#1f2d3d' }}>{t('upcoming-birthdays')} 🎂:</Text>
            {renderEvents(birthdayEvents, true)}
          </Section>

          {/* Anniversary Events Section */}
          <Section style={{ backgroundColor: '#fff', padding: '15px', color: '#000' }}>
            <Text style={{ fontSize: '20px', color: '#1f2d3d' }}>{t('upcoming-anniversaries')} 🎉:</Text>
            {renderEvents(anniversaryEvents, false)}
          </Section>

          {/* Button Section */}
          <Section style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button
              href={link}
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

          {/* Company Logo Section */}
          <Section style={{ textAlign: 'center' }}>{getCompanyLogo(company_image_url)}</Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WeeklyEventEmail;
