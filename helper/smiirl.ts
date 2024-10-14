import axios from 'axios';
import { PrismaClient } from '@prisma/client';
export async function updateSmiirl(prisma: PrismaClient) {
  try {
    const count = await prisma.member.count();
    await axios.get('http://api.smiirl.com/e08e3c392c28/set-number/f792bdd8a7f4deef6cb2909296537275/' + count);
  } catch (error) {
    console.error(error);
  }
}
