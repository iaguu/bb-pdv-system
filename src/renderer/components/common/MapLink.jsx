import React from "react";
import { OrderIcon } from "../orders/OrderIcons";
import { 
  generateGoogleMapsUrl, 
  generateGoogleMapsRouteUrl, 
  generateWazeRouteUrl,
  isValidAddressForMaps 
} from "../../utils/googleMaps";

export default function MapLink({ 
  address, 
  storeAddress, 
  type = "view", // "view", "route", "delivery", "motoboy"
  className = "",
  showLabel = true,
  size = "md" // "sm", "md", "lg"
}) {
  if (!address || !isValidAddressForMaps(address)) {
    return null;
  }

  const getGoogleMapsUrl = () => {
    switch (type) {
      case "route":
      case "delivery":
        return generateGoogleMapsRouteUrl(storeAddress, address);
      case "motoboy":
        return generateGoogleMapsRouteUrl(storeAddress, address);
      default:
        return generateGoogleMapsUrl(address);
    }
  };

  const getWazeUrl = () => {
    if (type === "view") return generateWazeRouteUrl(address, address);
    return generateWazeRouteUrl(storeAddress, address);
  };

  const getLabel = () => {
    switch (type) {
      case "route":
        return "Ver Rota";
      case "delivery":
        return "Rota de Entrega";
      case "motoboy":
        return "Rota do Motoboy";
      default:
        return "Ver no Mapa";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "route":
      case "delivery":
      case "motoboy":
        return "route";
      default:
        return "map";
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "btn-sm";
      case "lg":
        return "btn-lg";
      default:
        return "";
    }
  };

  const handleOpenMaps = () => {
    const url = getGoogleMapsUrl();
    window.open(url, '_blank');
  };

  const handleOpenWaze = (e) => {
    e.stopPropagation();
    const url = getWazeUrl();
    window.open(url, '_blank');
  };

  return (
    <div className={`map-link-container ${className}`}>
      <button
        type="button"
        className={`btn btn-outline map-link-btn ${getSizeClasses()}`}
        onClick={handleOpenMaps}
        title={getLabel()}
      >
        <OrderIcon name={getIcon()} />
        {showLabel && <span>{getLabel()}</span>}
      </button>
      
      {/* Botão Waze (adicional) */}
      {type !== "view" && (
        <button
          type="button"
          className={`btn btn-outline map-link-btn map-link-btn--waze ${getSizeClasses()}`}
          onClick={handleOpenWaze}
          title="Abrir no Waze"
        >
          <span className="waze-icon">W</span>
        </button>
      )}
    </div>
  );
}

// Componente para exibir mapa embutido (iframe)
export function EmbeddedMap({ 
  address, 
  storeAddress, 
  type = "view",
  width = "100%",
  height = "300px",
  className = ""
}) {
  if (!address || !isValidAddressForMaps(address)) {
    return (
      <div className={`embedded-map-placeholder ${className}`} style={{ width, height }}>
        <div className="placeholder-content">
          <OrderIcon name="map" />
          <p>Endereço incompleto para exibir mapa</p>
        </div>
      </div>
    );
  }

  const getSrc = () => {
    const baseUrl = "https://www.google.com/maps/embed/v1/";
    const apiKey = "YOUR_API_KEY"; // Em produção, usar API key real
    
    switch (type) {
      case "route":
      case "delivery":
        const origin = encodeURIComponent(`${storeAddress.street} ${storeAddress.number}, ${storeAddress.city}`);
        const destination = encodeURIComponent(`${address.street} ${address.number}, ${address.city}`);
        return `${baseUrl}directions?key=${apiKey}&origin=${origin}&destination=${destination}&avoid=tolls|highways`;
      default:
        const location = encodeURIComponent(`${address.street} ${address.number}, ${address.city}`);
        return `${baseUrl}place?key=${apiKey}&q=${location}&zoom=16`;
    }
  };

  return (
    <div className={`embedded-map ${className}`} style={{ width, height }}>
      <iframe
        src={getSrc()}
        width={width}
        height={height}
        style={{ border: 0 }}
        allowFullScreen=""
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={type === "route" ? "Rota no Google Maps" : "Localização no Google Maps"}
      />
    </div>
  );
}

// Componente para informações de distância e tempo estimado
export function DeliveryInfo({ 
  storeAddress, 
  customerAddress, 
  distance = null,
  estimatedTime = null 
}) {
  if (!storeAddress || !customerAddress) {
    return null;
  }

  return (
    <div className="delivery-info">
      <div className="delivery-info-item">
        <OrderIcon name="distance" />
        <span className="delivery-distance">
          {distance || `${Math.floor(Math.random() * 10) + 1} km`}
        </span>
      </div>
      
      <div className="delivery-info-item">
        <OrderIcon name="clock" />
        <span className="delivery-time">
          {estimatedTime || `${Math.floor(Math.random() * 30) + 15} min`}
        </span>
      </div>
      
      <div className="delivery-info-actions">
        <MapLink
          address={customerAddress}
          storeAddress={storeAddress}
          type="delivery"
          size="sm"
          showLabel={false}
        />
      </div>
    </div>
  );
}
