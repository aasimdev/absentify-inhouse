import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export class HttpClient {
  private static async sendRequest(url: string, config: AxiosRequestConfig): Promise<AxiosResponse<any>> {
    const response = await axios({
      url,
      method: config.method,
      data: config.data,
      headers: {
        ...config.headers
      }
    });

    return response;
  }

  public static get(url: string, headers: Record<string, any> = {}): Promise<AxiosResponse<any>> {
    return HttpClient.sendRequest(url, {
      method: 'GET',
      headers
    });
  }

  public static post(
    url: string,
    body: Record<string, any>,
    headers: Record<string, any> = {}
  ): Promise<AxiosResponse<any>> {
    return HttpClient.sendRequest(url, {
      method: 'POST',
      data: body,
      headers
    });
  }

  public static put(
    url: string,
    body: Record<string, any>,
    headers: Record<string, any> = {}
  ): Promise<AxiosResponse<any>> {
    return HttpClient.sendRequest(url, {
      method: 'PUT',
      data: body,
      headers
    });
  }

  public static patch(
    url: string,
    body: Record<string, any>,
    headers: Record<string, any> = {}
  ): Promise<AxiosResponse<any>> {
    return HttpClient.sendRequest(url, {
      method: 'PATCH',
      data: body,
      headers
    });
  }

  public static delete(url: string, headers: Record<string, any> = {}): Promise<AxiosResponse<any>> {
    return HttpClient.sendRequest(url, {
      method: 'DELETE',
      headers
    });
  }
}
