// utils.js — funções compartilhadas entre modais de cliente

export const digitsOnly = (s) => (s || "").replace(/\D/g, "");

export function normalizeCustomer(customer) {
  if (!customer) return null;
  const addr = customer.address || {};
  return {
    id: customer.id,
    name: customer.name || "",
    phone: customer.phone || "",
    cpf: customer.cpf || "",
    notes: customer.notes || "",
    createdAt: customer.createdAt || "",
    address: {
      cep: addr.cep || "",
      street: addr.street || "",
      number: addr.number || "",
      complement: addr.complement || "",
      neighborhood: addr.neighborhood || "",
      city: addr.city || "",
      state: addr.state || "",
    },
  };
}

export async function lookupCep(cepRaw) {
  const cepDigits = digitsOnly(cepRaw);
  if (cepDigits.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }

  const url = `https://viacep.com.br/ws/${cepDigits}/json/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ao consultar CEP.");

  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado.");

  return {
    cep: cepDigits,
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || "",
  };
}
