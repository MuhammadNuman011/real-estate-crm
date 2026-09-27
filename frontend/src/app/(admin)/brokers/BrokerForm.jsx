import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, CardTitle, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import * as yup from 'yup';
import PageBreadcrumb from '@/components/layout/PageBreadcrumb';
import PageMetaData from '@/components/PageTitle';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';

const COUNTRY_CODES = [{
  value: '+966',
  label: 'KSA +966'
}, {
  value: '+971',
  label: 'UAE +971'
}];

function nationalDigits(value) {
  const digits = String(value || '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return '';
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

function savedMobile(countryCode, localNumber) {
  const national = nationalDigits(localNumber);
  if (!/^\+966$|^\+971$/.test(countryCode) || !/^5\d{8}$/.test(national)) return '';
  return countryCode + national;
}

function splitMobile(stored) {
  if (typeof stored === 'string' && stored.startsWith('+966') && /^5\d{8}$/.test(stored.slice(4))) {
    return { country_code: '+966', mobile: '0' + stored.slice(4) };
  }
  if (typeof stored === 'string' && stored.startsWith('+971') && /^5\d{8}$/.test(stored.slice(4))) {
    return { country_code: '+971', mobile: '0' + stored.slice(4) };
  }
  return { country_code: '+966', mobile: typeof stored === 'string' ? stored : '' };
}

const schema = yup.object({
  name: yup.string().trim().required('Name is required'),
  email: yup.string().trim().email('Email must be valid').required('Email is required'),
  country_code: yup.string().oneOf(['+966', '+971'], 'Select a country code').required('Select a country code'),
  mobile: yup.string().trim().required('Mobile is required').test('mobile', 'Enter a mobile number like 05xxxxxxxx', value => /^5\d{8}$/.test(nationalDigits(value))),
  password: yup.string().test('password', function passwordRule(value) {
    const isEdit = Boolean(this.options.context?.isEdit);
    if (!isEdit && !value) {
      return this.createError({ message: 'Password is required' });
    }
    if (value && value.length < 8) {
      return this.createError({ message: 'Password must be at least 8 characters' });
    }
    return true;
  }),
  status: yup.string().oneOf(['active', 'inactive', 'blocked'], 'Status is required').required('Status is required'),
  license_number: yup.string().trim().default(''),
  bio: yup.string().trim().default(''),
  address: yup.string().trim().default('')
});

const defaultValues = {
  name: '',
  email: '',
  country_code: '+966',
  mobile: '',
  password: '',
  status: 'active',
  license_number: '',
  bio: '',
  address: ''
};

const BrokerForm = ({ mode }) => {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotificationContext();
  const [loading, setLoading] = useState(false);
  const [loadingBroker, setLoadingBroker] = useState(isEdit);
  const [error, setError] = useState('');
  const [pictureFile, setPictureFile] = useState(null);
  const [picturePreview, setPicturePreview] = useState('');
  const [pictureError, setPictureError] = useState('');
  const [keepPicture, setKeepPicture] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError: setFieldError,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
    context: { isEdit },
    defaultValues
  });
  const countryCode = watch('country_code');
  const localMobile = watch('mobile');
  const mobilePreview = savedMobile(countryCode, localMobile);

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await httpClient.get('/api/brokers/' + id);
        if (!active) return;
        const broker = res.data || {};
        const mobileParts = splitMobile(broker.mobile);
        setKeepPicture(broker.profile_picture || '');
        setPicturePreview(broker.profile_picture || '');
        setPictureFile(null);
        reset({
          name: broker.name ?? '',
          email: broker.email ?? '',
          country_code: mobileParts.country_code,
          mobile: mobileParts.mobile,
          password: '',
          status: broker.status ?? 'active',
          license_number: broker.license_number ?? '',
          bio: broker.bio ?? '',
          address: broker.address ?? ''
        });
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load broker.');
      } finally {
        if (active) setLoadingBroker(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, reset]);

  const onPictureChange = event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPictureError('Profile picture must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureError('Profile picture must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setPictureFile(result);
      setPicturePreview(result);
      setPictureError('');
    };
    reader.onerror = () => setPictureError('Unable to read the image.');
    reader.readAsDataURL(file);
  };

  const clearPicture = () => {
    setPictureFile(null);
    setPicturePreview('');
    setKeepPicture('');
    setPictureError('');
  };

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    setPictureError('');
    let profilePicture = null;
    if (pictureFile) profilePicture = pictureFile;
    else if (keepPicture) profilePicture = keepPicture;
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      country_code: values.country_code,
      mobile: values.mobile.trim(),
      profile_picture: profilePicture,
      status: values.status,
      license_number: values.license_number?.trim() || null,
      bio: values.bio?.trim() || null,
      address: values.address?.trim() || null
    };
    if (!isEdit || values.password) {
      payload.password = values.password;
    }

    try {
      if (isEdit) {
        await httpClient.patch('/api/brokers/' + id, payload);
      } else {
        await httpClient.post('/api/brokers', payload);
      }
      showNotification({
        message: isEdit ? 'Broker updated.' : 'Broker added.',
        variant: 'success'
      });
      navigate('/brokers');
    } catch (e) {
      const data = e.response?.data;
      const fields = data?.fields;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, message]) => {
          if (name === 'profile_picture') {
            setPictureError(message);
            return;
          }
          setFieldError(name, { message });
        });
      }
      setError(data?.error || (isEdit ? 'Unable to update broker.' : 'Unable to add broker.'));
    } finally {
      setLoading(false);
    }
  });

  const title = isEdit ? 'Update broker' : 'Add broker';

  return <>
      <PageMetaData title={title} />
      <PageBreadcrumb title={title} subName="Brokers" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            {title}
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          {loadingBroker ? <div className="text-center py-5">
              <Spinner animation="border" role="status" />
            </div> : <Form onSubmit={onSubmit} noValidate>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Name</Form.Label>
                    <Form.Control type="text" {...register('name')} isInvalid={Boolean(errors.name)} />
                    <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" {...register('email')} isInvalid={Boolean(errors.email)} />
                    <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Mobile</Form.Label>
                    <InputGroup hasValidation>
                      <Form.Select {...register('country_code')} isInvalid={Boolean(errors.country_code)} style={{ maxWidth: '140px' }}>
                        {COUNTRY_CODES.map(country => <option key={country.value} value={country.value}>{country.label}</option>)}
                      </Form.Select>
                      <Form.Control type="text" inputMode="numeric" placeholder="05xxxxxxxx" {...register('mobile')} isInvalid={Boolean(errors.mobile || errors.country_code)} />
                      <Form.Control.Feedback type="invalid">{errors.mobile?.message || errors.country_code?.message}</Form.Control.Feedback>
                    </InputGroup>
                    {mobilePreview ? <div className="text-muted small mt-1">Saved as {mobilePreview}</div> : null}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>License number</Form.Label>
                    <Form.Control type="text" {...register('license_number')} isInvalid={Boolean(errors.license_number)} />
                    <Form.Control.Feedback type="invalid">{errors.license_number?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" autoComplete="new-password" placeholder={isEdit ? 'Leave blank to keep the current password' : ''} {...register('password')} isInvalid={Boolean(errors.password)} />
                    <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <Form.Select {...register('status')} isInvalid={Boolean(errors.status)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="blocked">Blocked</option>
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.status?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Profile picture</Form.Label>
                    <Form.Control type="file" accept="image/jpeg,image/png,image/webp" onChange={onPictureChange} isInvalid={Boolean(pictureError)} />
                    {pictureError ? <div className="invalid-feedback d-block">{pictureError}</div> : null}
                    <div className="text-muted small mt-1">JPG, PNG, or WebP from your computer, up to 5 MB.</div>
                    {picturePreview ? <div className="mt-2 d-flex align-items-center gap-3">
                        <img src={picturePreview} alt="Profile preview" width="72" height="72" style={{ objectFit: 'cover', borderRadius: '4px' }} />
                        <Button type="button" variant="outline-danger" size="sm" onClick={clearPicture}>
                          Remove picture
                        </Button>
                      </div> : null}
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Address</Form.Label>
                    <Form.Control type="text" {...register('address')} isInvalid={Boolean(errors.address)} />
                    <Form.Control.Feedback type="invalid">{errors.address?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Bio</Form.Label>
                    <Form.Control as="textarea" rows={4} {...register('bio')} isInvalid={Boolean(errors.bio)} />
                    <Form.Control.Feedback type="invalid">{errors.bio?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} className="d-flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    {isEdit ? 'Update broker' : 'Add broker'}
                  </Button>
                  <Button type="button" variant="light" onClick={() => navigate('/brokers')}>
                    Cancel
                  </Button>
                </Col>
              </Row>
            </Form>}
        </CardBody>
      </Card>
    </>;
};

export default BrokerForm;
