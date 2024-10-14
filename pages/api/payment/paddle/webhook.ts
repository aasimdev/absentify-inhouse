// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { SubscriptionProvider } from '@prisma/client';
import { createVerify } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'php-serialize';

import { prisma } from '~/server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { body } = req;

  if (!validateWebhook(req.body)) {
    res.status(400).send('Invalid signature');
    return;
  }
  if (
    body.alert_name == 'subscription_created' ||
    body.alert_name == 'subscription_updated' ||
    body.alert_name == 'subscription_cancelled'
  ) {
    const passthrough: { workspace_id: string } = JSON.parse(body.passthrough);

    if (!passthrough.workspace_id) {
      res.status(400).json({ error: 'passthrough is not valid' });
      return;
    }

    let subscription = await prisma.subscription.findFirst({
      where: {
        subscription_plan_id: body.subscription_plan_id,
        subscription_id: body.subscription_id
      },
      select: { id: true, quantity: true, status: true }
    });

    if (subscription) {
      let q = subscription.quantity;
      if (body.new_quantity) {
        q = parseInt(body.new_quantity);
      } else if (body.quantity) {
        q = parseInt(body.quantity);
      }
      let past_due_since: Date | null = null;
      if (subscription.status != 'past_due' && body.status == 'past_due') {
        past_due_since = new Date();
      }
      if (body.status == 'active') {
        past_due_since = null;
      }

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: body.status,
          subscription_plan_id: body.subscription_plan_id,
          customer_user_id: body.user_id,
          currency: body.currency,
          quantity: q,
          cancellation_effective_date: body.cancellation_effective_date
            ? new Date(body.cancellation_effective_date)
            : null,
          past_due_since: past_due_since
        },
        select: { id: true }
      });
    } else {
      await prisma.subscription.create({
        data: {
          status: body.status,
          workspace_id: passthrough.workspace_id,
          provider: SubscriptionProvider.paddle,
          subscription_id: body.subscription_id,
          subscription_plan_id: body.subscription_plan_id,
          customer_user_id: body.user_id,
          quantity: parseInt(body.quantity),
          currency: body.currency,
          unit_price: body.unit_price ? parseFloat(body.unit_price) : 0,
          cancellation_effective_date: body.cancellation_effective_date
            ? new Date(body.cancellation_effective_date)
            : null
        },
        select: { id: true }
      });
    }
    await prisma.workspace.update({
      where: { id: passthrough.workspace_id },
      data: { old_pricing: true },
      select: { id: true }
    });
  }
  res.status(200).json({ success: true });
}

const pubKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAnq0RnSQhY//UzMfhWyH4
tVcSUqfYavLgiYvaOA9Gi7AbEFiQKkf8q5Dkqi2ak0Py1yntUvuCJ8EGfzcSvwVs
8ixSDoEp9kIN0aukkgcJOlc3tgPlfCVW5X8/bJ8eNVs1ZlBjsdhBKEQ3iAJGJmO9
GdQS0WBG3HoghjlSclbst+T9VkyCvK/RDu+GoVlEwqlbrQIkIcXO2bub8CXoZci6
+yjrbnG6CbRIAaAX7Kn02Mqfo4PJ2bsLVk5C2Z6SQbEn/a8dXKib9TVXBR0iDdni
p01CjMWNCTjJJoqv8hVFx19mJ7bZusEOtjR8X7OmktgaGLrXBybLkjmHzZ7+r7s4
u4S/q4fSsP5uHwP6lMQw8LAfJCb1Ax4Bo/Xw+L7ZIVVzlVRJl7lsx6XkWEunK8vJ
ZxAvpmJFjRC33K+nAoH4FL/O8mER0Utz+XMcoTncCTgSwh89usuWirFHi0um1j/0
QcghQmpLxMTbTg5RCNq5YFAATKJ1o7XAii5IgW507iQvFQXYzFwpuilWbZygUdGC
Bhc/lw/Ujd2iapMJ2hPsbvtL5/7fy4uw4SoP3J6jXLylz/QZ9AHwVaXscoZaBaqA
89cwhKoaqpmPF5cNwQlshM2GlltpaBZJtGzRP7r8IQFIccOVnKJQHk5SiASPqFIM
r4KEN3qwyptxPD+9PNFwI2ECAwEAAQ==
-----END PUBLIC KEY-----`;

const pubKeyDev = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAqsZP6yQCVj1+tTwQY9Rf
5dBWgC5+hNFQ0MUA91eH6qDC7u9bxwQFEY8bg5irpDlAfvBkpML1/DCsrRfb2BI2
VSDSXG/jVZ46tqNN+gHRL7hc7NpMSplosFImaSdXtZdXQm5izzJYLa4orb/W+2XZ
dztUsxN5reWZhQ8yM6yuImruDPYA2ZmM8HHUSMfZ5g20roQ2mu+Oyn3T95Cx44SC
fjRaf2XQknjGbNk0DEo2mktbYvRvlggNaJXLeKrizXPbwa0GQT7G8U66IyKJkVAD
WTeQE1/nuWoxhahpgrshRHjhgw3MTEPUXbbIEwDER84Icw+859vJAtYaTcteiAOW
q63/4q+QrzOtQW7QqOXkMUZV+0RAXSMLJWMljarXkHtQAPNs2hPlaRmqCC6QQnJQ
Sliv0/wGH+NRnOy0s6XISJqLrakcqStyzI4EsvQ2q1XptIUIDiaOJmltmmADEyuH
YQFChPDqfnt1cAJUAlcOyI3S8j3J8nxgx2ueYYAp9F6YvfOIKWpd7wL03kcXPHcI
HGwYmDWbrQnIvh9SSqX9U0S+L13xFeY6v3r9pmFwqEXuDk5yxUSGEB98TZXCSupM
1PsWo+jWPgTTYqr2MMOFHPpHmQeBt61CvKIQZWoS9E3qFpGvyC1fEDsTvPs3dyb0
SgT+qWSLwOx49/Qub8YrttcCAwEAAQ==
-----END PUBLIC KEY-----`;

function validateWebhook(jsonObj: any) {
  // Grab p_signature
  const mySig = Buffer.from(jsonObj.p_signature, 'base64');
  // Remove p_signature from object - not included in array of fields used in verification.
  delete jsonObj.p_signature;
  // Need to sort array by key in ascending order
  jsonObj = ksort(jsonObj);
  for (const property in jsonObj) {
    if (jsonObj.hasOwnProperty(property) && typeof jsonObj[property] !== 'string') {
      if (Array.isArray(jsonObj[property])) {
        // is it an array
        jsonObj[property] = jsonObj[property].toString();
      } else {
        // if its not an array and not a string, then it is a JSON obj
        jsonObj[property] = JSON.stringify(jsonObj[property]);
      }
    }
  }
  // Serialise remaining fields of jsonObj
  const serialized = serialize(jsonObj);
  // verify the serialized array against the signature using SHA1 with your public key.
  const verifier = createVerify('sha1');
  verifier.update(serialized);
  verifier.end();

  const verification = verifier.verify(
    process.env.NEXT_PUBLIC_RUNMODE == 'Preview' || process.env.NEXT_PUBLIC_RUNMODE == 'Development'
      ? pubKeyDev
      : pubKey,
    mySig
  );
  // Used in response if statement
  return verification;
}
function ksort(obj: any) {
  const keys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const i in keys) {
    // @ts-ignore
    sortedObj[keys[i]] = obj[keys[i]];
  }
  return sortedObj;
}
