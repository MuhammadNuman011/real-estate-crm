import { Map, Marker, GoogleApiWrapper } from 'google-maps-react';
import { useEffect, useRef } from 'react';
import { FormControl } from 'react-bootstrap';

const MAPS_API_KEY = 'AIzaSyDsucrEdmswqYrw0f6ej3bf4M4suDeRgNA';
const DEFAULT_CENTER = { lat: 25.2048, lng: 55.2708 };

const LocationMap = ({ google, lat, lng, onChange }) => {
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  const hasPoint = lat !== '' && lng !== '' && Number.isFinite(latNumber) && Number.isFinite(lngNumber);
  const position = hasPoint ? { lat: latNumber, lng: lngNumber } : DEFAULT_CENTER;

  useEffect(() => {
    if (!google?.maps?.places || !searchRef.current) return undefined;
    const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
      fields: ['geometry']
    });
    const listener = autocomplete.addListener('place_changed', () => {
      const location = autocomplete.getPlace()?.geometry?.location;
      if (!location) return;
      const nextLat = location.lat();
      const nextLng = location.lng();
      onChange(String(nextLat), String(nextLng));
      if (mapRef.current) {
        mapRef.current.panTo({ lat: nextLat, lng: nextLng });
        mapRef.current.setZoom(16);
      }
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [google, onChange]);

  const handleMapClick = (_props, _map, event) => {
    if (!event?.latLng) return;
    onChange(String(event.latLng.lat()), String(event.latLng.lng()));
  };

  return <>
      <FormControl ref={searchRef} className="mb-2" placeholder="Search an address" autoComplete="off" />
      <div className="gmaps" style={{
      position: 'relative',
      overflow: 'hidden'
    }}>
        <Map google={google} zoom={hasPoint ? 15 : 11} center={position} initialCenter={DEFAULT_CENTER} onClick={handleMapClick} onReady={(_props, map) => {
        mapRef.current = map;
      }} style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
          {hasPoint && <Marker position={position} />}
        </Map>
      </div>
    </>;
};

export default GoogleApiWrapper({
  apiKey: MAPS_API_KEY,
  libraries: ['places']
})(LocationMap);
