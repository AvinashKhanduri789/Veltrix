const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new APIError(errorData?.message || response.statusText, response.status);
  }
  return response.json();
}

export const api = {
  createFunction: async (name, language, file) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("language", language);
    formData.append("file", file);

    console.log("formData in create fucntion is : ", formData);

    const response = await fetch(`${BASE_URL}/functions`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(response);
  },

  getFunctions: async () => {
    const response = await fetch(`${BASE_URL}/functions`);
    return handleResponse(response);
  },

  deleteFunction: async (id) => {
    const response = await fetch(`${BASE_URL}/functions/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },

  triggerExecution: async (functionId, inputPayload = {}) => {
    const response = await fetch(`${BASE_URL}/executions/${functionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputPayload }),
    });
    return handleResponse(response);
  },

  getExecution: async (executionId) => {
    const response = await fetch(`${BASE_URL}/executions/${executionId}`);
    return handleResponse(response);
  },

  getExecutionsByFunction: async (functionId) => {
    const response = await fetch(`${BASE_URL}/executions/function/${functionId}`);
    return handleResponse(response);
  },

  getLogsUrl: (executionId) => {
    return `${BASE_URL}/executions/${executionId}/logs`;
  }
};
