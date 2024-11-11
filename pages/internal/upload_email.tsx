import { useState } from 'react';

export default function UploadEmail() {
  const [file, setFile] = useState<File | null | undefined>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files ? e.target.files[0] : null;
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please upload a file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/helper/upload-email', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    alert(result.message);
  };

  return (
    <div>
      <h1>Upload Excel to Replace Emails</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" accept=".xlsx" onChange={handleFileChange} />
        <button type="submit">Upload</button>
      </form>
    </div>
  );
}
