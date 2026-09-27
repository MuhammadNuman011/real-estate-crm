import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';
import LocationMap from '../LocationMap';

const schema = yup.object({
  rent_sale: yup.string().oneOf(['rent', 'sale'], 'Listing type is required').required('Listing type is required'),
  price: yup.number().typeError('Price is required').min(0, 'Price must be at least 0').required('Price is required'),
  property_type: yup.string().trim().default('Villa'),
  bedrooms: yup.number().typeError('Bedrooms is required').integer('Bedrooms must be a whole number').min(0, 'Bedrooms must be at least 0').required('Bedrooms is required'),
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

const AddPropertyPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showNotification } = useNotificationContext();
  const {
    register,
    handleSubmit,
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

  const handleLocationChange = useCallback((nextLat, nextLng) => {
    setValue('lat', nextLat, { shouldValidate: true, shouldDirty: true });
    setValue('long', nextLng, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    try {
      await httpClient.post('/api/properties', {
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
      });
      showNotification({
        message: 'Property added.',
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
      setError(data?.error || 'Unable to add property.');
    } finally {
      setLoading(false);
    }
  });

  return <>
      <PageMetaData title="Add property" />
      <PageBreadcrumb title="Add property" subName="Properties" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            Add property
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={onSubmit} noValidate>
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
                  <Form.Control type="text" {...register('property_type')} isInvalid={Boolean(errors.property_type)} />
                  <Form.Control.Feedback type="invalid">{errors.property_type?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Bedrooms</Form.Label>
                  <Form.Control type="number" min="0" step="1" {...register('bedrooms')} isInvalid={Boolean(errors.bedrooms)} />
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
              <Col xs={12}>
                <Button type="submit" disabled={loading}>
                  {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                  Add property
                </Button>
              </Col>
            </Row>
          </Form>
        </CardBody>
      </Card>
    </>;
};

export default AddPropertyPage;
