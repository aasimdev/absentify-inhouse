export default function getFileNames(userId: string): Array<string> {
  const imageSizes: number[] = [32, 64, 128, 256, 512];
  const arrayOfNames: Array<string> = [`${userId}_${imageSizes[0]}x${imageSizes[0]}.jpeg`, `${userId}_${imageSizes[1]}x${imageSizes[1]}.jpeg`,
  `${userId}_${imageSizes[2]}x${imageSizes[2]}.jpeg`, `${userId}_${imageSizes[3]}x${imageSizes[3]}.jpeg`, `${userId}_${imageSizes[4]}x${imageSizes[4]}.jpeg`];

  return arrayOfNames;
}