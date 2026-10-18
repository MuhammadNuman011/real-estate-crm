import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import * as yup from 'yup';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';
import LocationMap from './LocationMap';

const schema = yup.object({
  rent_sale: yup.string().oneOf(['rent', 'sale'], 'Listing type is required').required('Listing type is required'),
  price: yup.number().typeError('Price is required').min(0, 'Price must be at least 0').required('Price is required'),
  property_type: yup.string().trim().default('Villa'),
  bedrooms: yup.number().typeError('Bedrooms is required').integer('Bedrooms must be a whole number').min(0, 'Bedrooms must be at least 0').required('Bedrooms is required').test('studio-bedroom-limit', 'Studio properties cannot have more than 1 bedroom', function (value) {
    return this.parent.property_type?.trim().toLowerCase() !== 'studio' || value <= 1;
  }),
  maid_room: yup.string().oneOf(['yes', 'no'], 'Maid room is required').required('Maid room is required'),
  bathrooms: yup.number().typeError('Bathrooms is required').integer('Bathrooms must be a whole number').min(0, 'Bathrooms must be at least 0').required('Bathrooms is required'),
  furnishing: yup.string().oneOf(['furnished', 'unfurnished', 'semi-furnished']).required(),
  area: yup.number().typeError('Area is required').min(0, 'Area must be at least 0').required('Area is required'),
  area_unit: yup.string().oneOf(['sqft', 'sqm']).required(),
  available_from: yup.string().default(''),
  allowed_nationalities: yup.string().trim().required('Allowed nationalities is required'),
  status: yup.string().oneOf(['inactive', 'active']).required(),
  lat: yup.string().trim().required('Pick a location on the map').test('lat', 'Enter a valid latitude', value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= -90 && number <= 90;
  }),
  long: yup.string().trim().required('Pick a location on the map').test('long', 'Enter a valid longitude', value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= -180 && number <= 180;
  }),
  description: yup.string().trim().required('Description is required')
});

const defaultValues = {
  rent_sale: '',
  price: '',
  property_type: 'Villa',
  bedrooms: '',
  maid_room: '',
  bathrooms: '',
  furnishing: 'unfurnished',
  area: '',
  area_unit: 'sqft',
  available_from: '',
  allowed_nationalities: '',
  status: 'inactive',
  lat: '',
  long: '',
  description: ''
};

function dateInputValue(value) {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : '';
}

function maidRoomValue(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 'yes';
  if (value === false || value === 0 || value === '0' || value === 'false') return 'no';
  return '';
}

function toFormValues(property) {
  return {
    rent_sale: property.rent_sale ?? '',
    price: property.price ?? '',
    property_type: property.property_type || 'Villa',
    bedrooms: property.bedrooms ?? '',
    maid_room: maidRoomValue(property.maid_room),
    bathrooms: property.bathrooms ?? '',
    furnishing: property.furnishing || 'unfurnished',
    area: property.area ?? '',
    area_unit: property.area_unit || 'sqft',
    available_from: dateInputValue(property.available_from),
    allowed_nationalities: property.allowed_nationalities ?? '',
    status: property.status || 'inactive',
    lat: property.lat == null ? '' : String(property.lat),
    long: property.long == null ? '' : String(property.long),
    description: property.description ?? ''
  };
}

function propertyPayload(values) {
  return {
    rent_sale: values.rent_sale,
    price: values.price,
    property_type: values.property_type?.trim() || 'Villa',
    bedrooms: values.bedrooms,
    maid_room: values.maid_room === 'yes',
    bathrooms: values.bathrooms,
    furnishing: values.furnishing,
    area: values.area,
    area_unit: values.area_unit,
    available_from: values.available_from || null,
    allowed_nationalities: values.allowed_nationalities.trim(),
    status: values.status,
    lat: values.lat.trim(),
    long: values.long.trim(),
    description: values.description.trim()
  };
}

const PropertyForm = ({ mode }) => {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(isEdit);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [propertyTypesLoading, setPropertyTypesLoading] = useState(true);
  const [error, setError] = useState('');
  const { showNotification } = useNotificationContext();
  const {
    register,
    getValues,
    handleSubmit,
    reset,
    setValue,
    setError: setFieldError,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues
  });
  const lat = watch('lat');
  const lng = watch('long');
  const selectedType = watch('property_type');
  const isStudio = selectedType?.trim().toLowerCase() === 'studio';
  const typeOptions = selectedType && !propertyTypes.includes(selectedType) ? [selectedType, ...propertyTypes] : propertyTypes;
  const canChooseType = isEdit ? typeOptions.length > 0 : propertyTypes.length > 0;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await httpClient.get('/api/properties/types');
        if (!active) return;
        const types = Array.isArray(response.data) ? response.data.filter(type => typeof type === 'string' && type.trim()) : [];
        setPropertyTypes(types);
        if (!isEdit && types.length && !types.includes(getValues('property_type'))) {
          setValue('property_type', types[0], { shouldValidate: true });
        }
      } catch (e) {
        if (active) {
          setError(e.response?.data?.error || 'Unable to load property types.');
        }
      } finally {
        if (active) setPropertyTypesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getValues, isEdit, setValue]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await httpClient.get('/api/properties/' + id);
        if (!active) return;
        reset(toFormValues(response.data || {}));
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load property.');
      } finally {
        if (active) setLoadingProperty(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, reset]);

  const handleLocationChange = useCallback((nextLat, nextLng) => {
    setValue('lat', nextLat, { shouldValidate: true, shouldDirty: true });
    setValue('long', nextLng, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    try {
      const payload = propertyPayload(values);
      if (isEdit) {
        await httpClient.patch('/api/properties/' + id, payload);
      } else {
        await httpClient.post('/api/properties', payload);
      }
      showNotification({
        message: isEdit ? 'Property updated.' : 'Property added.',
        variant: 'success'
      });
      navigate('/properties');
    } catch (e) {
      const data = e.response?.data;
      const fields = data?.fields;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, message]) => {
          setFieldError(name, { message });
        });
      }
      setError(data?.error || (isEdit ? 'Unable to update property.' : 'Unable to add property.'));
    } finally {
      setLoading(false);
    }
  });

  const title = isEdit ? 'Update property' : 'Add property';

  return <>
      <PageMetaData title={title} />
      <PageBreadcrumb title={title} subName="Properties" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            {title}
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          {loadingProperty ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Form onSubmit={onSubmit} noValidate>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Listing type</Form.Label>
                  <Form.Select {...register('rent_sale')} isInvalid={Boolean(errors.rent_sale)}>
                    <option value="">Select rent or sale</option>
                    <option value="rent">Rent</option>
                    <option value="sale">Sale</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.rent_sale?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Price</Form.Label>
                  <Form.Control type="number" min="0" step="0.01" {...register('price')} isInvalid={Boolean(errors.price)} />
                  <Form.Control.Feedback type="invalid">{errors.price?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Property type</Form.Label>
                  <Form.Select {...register('property_type')} disabled={propertyTypesLoading || typeOptions.length === 0} isInvalid={Boolean(errors.property_type)}>
                    {propertyTypesLoading ? <option value="">Loading property types...</option> : typeOptions.length === 0 ? <option value="">No property types available</option> : typeOptions.map(type => <option key={type} value={type}>
                          {type}
                        </option>)}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.property_type?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Bedrooms</Form.Label>
                  <Form.Control type="number" min="0" max={isStudio ? 1 : undefined} step="1" {...register('bedrooms')} isInvalid={Boolean(errors.bedrooms)} />
                  <Form.Control.Feedback type="invalid">{errors.bedrooms?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Bathrooms</Form.Label>
                  <Form.Control type="number" min="0" step="1" {...register('bathrooms')} isInvalid={Boolean(errors.bathrooms)} />
                  <Form.Control.Feedback type="invalid">{errors.bathrooms?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Maid room</Form.Label>
                  <Form.Select {...register('maid_room')} isInvalid={Boolean(errors.maid_room)}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.maid_room?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Furnishing</Form.Label>
                  <Form.Select {...register('furnishing')} isInvalid={Boolean(errors.furnishing)}>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="semi-furnished">Semi-furnished</option>
                    <option value="furnished">Furnished</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.furnishing?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select {...register('status')} isInvalid={Boolean(errors.status)}>
                    <option value="inactive">Inactive</option>
                    <option value="active">Active</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.status?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Area</Form.Label>
                  <Form.Control type="number" min="0" step="0.01" {...register('area')} isInvalid={Boolean(errors.area)} />
                  <Form.Control.Feedback type="invalid">{errors.area?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Area unit</Form.Label>
                  <Form.Select {...register('area_unit')} isInvalid={Boolean(errors.area_unit)}>
                    <option value="sqft">sqft</option>
                    <option value="sqm">sqm</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.area_unit?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Available from</Form.Label>
                  <Form.Control type="date" {...register('available_from')} isInvalid={Boolean(errors.available_from)} />
                  <Form.Control.Feedback type="invalid">{errors.available_from?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Allowed nationalities</Form.Label>
                  <Form.Control type="text" placeholder="e.g. All, or UAE, India" {...register('allowed_nationalities')} isInvalid={Boolean(errors.allowed_nationalities)} />
                  <Form.Control.Feedback type="invalid">{errors.allowed_nationalities?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Location</Form.Label>
                  <div className="text-muted small mb-2">Search an address or click the map to set latitude and longitude.</div>
                  <LocationMap lat={lat} lng={lng} onChange={handleLocationChange} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Latitude</Form.Label>
                  <Form.Control type="text" {...register('lat')} isInvalid={Boolean(errors.lat)} />
                  <Form.Control.Feedback type="invalid">{errors.lat?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Longitude</Form.Label>
                  <Form.Control type="text" {...register('long')} isInvalid={Boolean(errors.long)} />
                  <Form.Control.Feedback type="invalid">{errors.long?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" rows={4} {...register('description')} isInvalid={Boolean(errors.description)} />
                  <Form.Control.Feedback type="invalid">{errors.description?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12} className="d-flex gap-2">
                <Button type="submit" disabled={loading || loadingProperty || propertyTypesLoading || !canChooseType}>
                  {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                  {isEdit ? 'Update property' : 'Add property'}
                </Button>
                <Button type="button" variant="light" onClick={() => navigate('/properties')}>
                  Cancel
                </Button>
              </Col>
            </Row>
          </Form>}
        </CardBody>
      </Card>
    </>;
};

export default PropertyForm;
