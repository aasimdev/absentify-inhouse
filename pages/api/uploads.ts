import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import { prisma } from '~/server/db';
import { defaultWorkspaceSelect } from '~/server/api/routers/workspace';
import { current_member_Select } from '~/server/api/trpc';
import { getIronSession } from 'iron-session';
import { SessionData, getIronSessionConfig } from '~/utils/ironSessionConfig';
import { SizedImage, resizeImages } from '~/inngest/Functions/updateMemberProfile';
import { hasEnterpriseSubscription } from '~/lib/subscriptionHelper';

export const config = {
  api: {
    bodyParser: false
  }
};

const allowedFileTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];

const fileFilter = (_req: any, file: any, cb: any) => {
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    error.message = 'Only jpeg/png/jpg/webp/svg+xml files are allowed';
    cb(error);
  }
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: fileFilter
});

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

    if (!session.user?.member_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let current_member = await prisma.member.findUnique({
      where: { id: session.user.member_id },
      select: current_member_Select
    });

    if (!current_member) {
      return res.status(400).json({ message: 'The member with the requested identifier does not exist' });
    }

    const workspace = await prisma.workspace.findUnique({
      select: defaultWorkspaceSelect,
      where: { id: current_member.workspace_id }
    });
    if (!workspace) {
      return res.status(400).json({ message: 'The workspace with the requested identifier does not exist' });
    }
    const enterprisePlan = hasEnterpriseSubscription(workspace.subscriptions);
    if (current_member.is_admin !== true || !enterprisePlan) {
      return res.status(400).json({ message: "You don't have access or a suitable subscription plan" });
    }
    multerUpload.single('file')(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(500).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: "Couldn't upload a file" });
      }
      const fileBuffer = req.file.buffer;
      let imageSizes: Array<number | string> = [32, 96, 256, '400landscape80'];
      if (req.body.type === 'favicon') imageSizes = [96];
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = workspace.id + uniqueSuffix;
      const resizedImages: SizedImage[] = await resizeImages(fileBuffer, imageSizes, filename);
      const imageUrls: string[] = [];
      for (let index = 0; index < resizedImages.length; index++) {
        const image = resizedImages[index];
        if (!image) continue;
        const blobServiceClient = new BlobServiceClient(process.env.AZURE_BLOB_COMPANY_LOGO_URL + '');
        const containerClient = blobServiceClient.getContainerClient('');
        const blockBlobClient = containerClient.getBlockBlobClient(image.filename);
        const blobOptions = { blobHTTPHeaders: { blobContentType: 'image/jpeg' } };
        await blockBlobClient.uploadData(image.buffer, blobOptions);
        const imageUrl = blockBlobClient.url;
        imageUrls.push(imageUrl);
      }
      if (req.body.type === 'favicon') {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { favicon_url: imageUrls[0] },
          select: { id: true }
        });
      } else {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { company_logo_url: imageUrls[0] },
          select: { id: true }
        });
      }
      res.status(200).json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading file' });
  }
}
