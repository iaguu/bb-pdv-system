// Google Maps Integration Utilities

/**
 * Gera URL do Google Maps para um endereço
 * @param {Object} address - Objeto de endereço
 * @returns {string} URL do Google Maps
 */
export function generateGoogleMapsUrl(address) {
  if (!address) return '#';
  
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.number) parts.push(address.number);
  if (address.neighborhood) parts.push(address.neighborhood);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.cep) parts.push(address.cep);
  
  const addressString = parts.join(', ');
  const encodedAddress = encodeURIComponent(addressString);
  
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
}

/**
 * Gera URL do Google Maps para rota de um ponto A para um ponto B
 * @param {Object} origin - Endereço de origem
 * @param {Object} destination - Endereço de destino
 * @returns {string} URL do Google Maps com rota
 */
export function generateGoogleMapsRouteUrl(origin, destination) {
  if (!origin || !destination) return '#';
  
  const formatAddress = (addr) => {
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.number) parts.push(addr.number);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.cep) parts.push(addr.cep);
    return parts.join(', ');
  };
  
  const originStr = encodeURIComponent(formatAddress(origin));
  const destStr = encodeURIComponent(formatAddress(destination));
  
  return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}`;
}

/**
 * Gera URL do Google Maps para rota da loja para o cliente
 * @param {Object} storeAddress - Endereço da loja
 * @param {Object} customerAddress - Endereço do cliente
 * @returns {string} URL do Google Maps com rota
 */
export function generateDeliveryRouteUrl(storeAddress, customerAddress) {
  return generateGoogleMapsRouteUrl(storeAddress, customerAddress);
}

/**
 * Gera URL do Google Maps para rota do motoboy para o cliente
 * @param {Object} motoboyLocation - Localização atual do motoboy (opcional)
 * @param {Object} customerAddress - Endereço do cliente
 * @param {Object} storeAddress - Endereço da loja (fallback)
 * @returns {string} URL do Google Maps com rota
 */
export function generateMotoboyRouteUrl(motoboyLocation, customerAddress, storeAddress) {
  const origin = motoboyLocation || storeAddress;
  return generateGoogleMapsRouteUrl(origin, customerAddress);
}

/**
 * Gera URL do Waze para rota
 * @param {Object} origin - Endereço de origem
 * @param {Object} destination - Endereço de destino
 * @returns {string} URL do Waze com rota
 */
export function generateWazeRouteUrl(origin, destination) {
  if (!origin || !destination) return '#';
  
  const formatAddress = (addr) => {
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.number) parts.push(addr.number);
    if (addr.neighborhood) parts.push(addr.neighborhood);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.cep) parts.push(addr.cep);
    return parts.join(', ');
  };
  
  const destStr = encodeURIComponent(formatAddress(destination));
  
  return `https://waze.com/ul?ll=${encodeURIComponent(destination.lat || '')},${encodeURIComponent(destination.lng || '')}&navigate=yes&q=${destStr}`;
}

/**
 * Verifica se um endereço é completo para gerar mapa
 * @param {Object} address - Objeto de endereço
 * @returns {boolean} True se endereço for válido
 */
export function isValidAddressForMaps(address) {
  if (!address) return false;
  
  const hasStreet = !!address.street;
  const hasNumber = !!address.number;
  const hasNeighborhood = !!address.neighborhood;
  const hasCity = !!address.city;
  const hasState = !!address.state;
  
  // Mínimo necessário: rua + número + bairro
  return hasStreet && hasNumber && hasNeighborhood;
}

/**
 * Gera coordenadas aproximadas baseadas no CEP (simulação)
 * @param {string} cep - CEP no formato 00000-000
 * @returns {Object} Objeto com lat e lng
 */
export function generateCoordinatesFromCep(cep) {
  // Esta é uma simulação. Em produção, você usaria uma API de geocodificação
  const cepDigits = cep.replace(/\D/g, '');
  
  // Gera coordenadas "falsas" baseadas no CEP para demonstração
  const baseLat = -23.5505; // São Paulo
  const baseLng = -46.6333;
  
  const offset = (parseInt(cepDigits.slice(0, 3)) / 1000) * 0.1;
  
  return {
    lat: baseLat + offset,
    lng: baseLng + offset
  };
}
