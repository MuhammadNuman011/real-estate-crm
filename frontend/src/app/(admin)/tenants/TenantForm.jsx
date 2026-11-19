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
import { IMAGE_FILE_ACCEPT, prepareImageFile } from '@/helpers/imageFile';
import { mediaUrl } from '@/helpers/mediaUrl';

const COUNTRY_CODES = [{
  value: '+966',
  label: 'KSA +966'
}, {
  value: '+971',
  label: 'UAE +971'
}];

const NATIONALITIES = [
  'Afghan',
  'Algerian',
  'American',
  'Australian',
  'Bahraini',
  'Bangladeshi',
  'British',
  'Canadian',
  'Chinese',
  'Egyptian',
  'Emirati',
  'Ethiopian',
  'Filipino',
  'French',
  'German',
  'Indian',
  'Indonesian',
  'Iranian',
  'Iraqi',
  'Italian',
  'Jordanian',
  'Kenyan',
  'Kuwaiti',
  'Lebanese',
  'Libyan',
  'Malaysian',
  'Moroccan',
  'Nepalese',
  'Nigerian',
  'Omani',
  'Pakistani',
  'Palestinian',
  'Qatari',
  'Russian',
  'Saudi',
  'Somali',
  'South African',
  'Sri Lankan',
  'Sudanese',
  'Syrian',
  'Tunisian',
  'Turkish',
  'Ukrainian',
  'Yemeni'
];

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
  nationality: yup.string().oneOf(NATIONALITIES, 'Select a nationality').required('Select a nationality'),
  country_code: yup.string().oneOf(['+966', '+971'], 'Select a country code').required('Select a country code'),
  mobile: yup.string().trim().required('Mobile is required').test('mobile', 'Enter a mobile number like 05xxxxxxxx', value => /^5\d{8}$/.test(nationalDigits(value))),
  status: yup.string().oneOf(['active', 'inactive'], 'Status is required').required('Status is required')
});

const defaultValues = {
  name: '',
  email: '',
  nationality: '',
  country_code: '+966',
  mobile: '',
  status: 'active'
};

const TenantForm = ({ mode }) => {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotificationContext();
  const [loading, setLoading] = useState(false);
  const [loadingTenant, setLoadingTenant] = useState(isEdit);
  const [error, setError] = useState('');
  const [frontFile, setFrontFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [frontError, setFrontError] = useState('');
  const [keepFront, setKeepFront] = useState('');
  const [backFile, setBackFile] = useState(null);
  const [backPreview, setBackPreview] = useState('');
  const [backError, setBackError] = useState('');
  const [keepBack, setKeepBack] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError: setFieldError,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
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
        const res = await httpClient.get('/api/tenants/' + id);
        if (!active) return;
        const tenant = res.data || {};
        const mobileParts = splitMobile(tenant.mobile);
        setKeepFront(tenant.national_id_front || '');
        setFrontPreview(tenant.national_id_front || '');
        setFrontFile(null);
        setKeepBack(tenant.national_id_back || '');
        setBackPreview(tenant.national_id_back || '');
        setBackFile(null);
        reset({
          name: tenant.name ?? '',
          email: tenant.email ?? '',
          nationality: tenant.nationality ?? '',
          country_code: mobileParts.country_code,
          mobile: mobileParts.mobile,
          status: tenant.status ?? 'active'
        });
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.error || 'Unable to load tenant.');
      } finally {
        if (active) setLoadingTenant(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, reset]);

  const onPictureChange = async (event, setFile, setPreview, setErrorMessage) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const prepared = await prepareImageFile(file);
    event.target.value = '';
    if (prepared.error) {
      setErrorMessage(prepared.error);
      return;
    }
    setFile(prepared.dataUrl);
    setPreview(prepared.dataUrl);
    setErrorMessage('');
  };

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError('');
    const nextFrontError = frontFile || keepFront ? '' : 'National ID front is required.';
    const nextBackError = backFile || keepBack ? '' : 'National ID back is required.';
    setFrontError(nextFrontError);
    setBackError(nextBackError);
    if (nextFrontError || nextBackError) {
      setLoading(false);
      return;
    }

    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      nationality: values.nationality.trim(),
      country_code: values.country_code,
      mobile: values.mobile.trim(),
      status: values.status,
      national_id_front: frontFile || keepFront,
      national_id_back: backFile || keepBack
    };

    try {
      if (isEdit) {
        await httpClient.patch('/api/tenants/' + id, payload);
      } else {
        await httpClient.post('/api/tenants', payload);
      }
      showNotification({
        message: isEdit ? 'Tenant updated.' : 'Tenant added.',
        variant: 'success'
      });
      navigate('/tenants');
    } catch (e) {
      const data = e.response?.data;
      const fields = data?.fields;
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([name, message]) => {
          if (name === 'national_id_front') {
            setFrontError(message);
            return;
          }
          if (name === 'national_id_back') {
            setBackError(message);
            return;
          }
          setFieldError(name, { message });
        });
      }
      setError(data?.error || (isEdit ? 'Unable to update tenant.' : 'Unable to add tenant.'));
    } finally {
      setLoading(false);
    }
  });

  const title = isEdit ? 'Update tenant' : 'Add tenant';

  return <>
      <PageMetaData title={title} />
      <PageBreadcrumb title={title} subName="Tenants" />
      <Card>
        <CardBody>
          <CardTitle as="h5" className="mb-3">
            {title}
          </CardTitle>
          {error && <Alert variant="danger">{error}</Alert>}
          {loadingTenant ? <div className="text-center py-5">
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
                    <Form.Label>Nationality</Form.Label>
                    <Form.Select {...register('nationality')} isInvalid={Boolean(errors.nationality)}>
                      <option value="">Select nationality</option>
                      {NATIONALITIES.map(nationality => <option key={nationality} value={nationality}>{nationality}</option>)}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.nationality?.message}</Form.Control.Feedback>
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
                    <Form.Label>Status</Form.Label>
                    <Form.Select {...register('status')} isInvalid={Boolean(errors.status)}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.status?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>National ID front</Form.Label>
                    <Form.Control type="file" accept={IMAGE_FILE_ACCEPT} onChange={event => onPictureChange(event, setFrontFile, setFrontPreview, setFrontError)} isInvalid={Boolean(frontError)} />
                    {frontError ? <div className="invalid-feedback d-block">{frontError}</div> : null}
                    <div className="text-muted small mt-1">JPG, PNG, WebP, HEIC, or HEIF. Large iPhone photos are resized to fit 5 MB.</div>
                    {frontPreview ? <div className="mt-2 d-flex align-items-center gap-3">
                        <img src={mediaUrl(frontPreview)} alt="National ID front preview" width="96" height="64" style={{ objectFit: 'cover', borderRadius: '4px' }} />
                        <Button type="button" variant="outline-danger" size="sm" onClick={() => {
                          setFrontFile(null);
                          setFrontPreview('');
                          setKeepFront('');
                          setFrontError('');
                        }}>
                          Remove picture
                        </Button>
                      </div> : null}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>National ID back</Form.Label>
                    <Form.Control type="file" accept={IMAGE_FILE_ACCEPT} onChange={event => onPictureChange(event, setBackFile, setBackPreview, setBackError)} isInvalid={Boolean(backError)} />
                    {backError ? <div className="invalid-feedback d-block">{backError}</div> : null}
                    <div className="text-muted small mt-1">JPG, PNG, WebP, HEIC, or HEIF. Large iPhone photos are resized to fit 5 MB.</div>
                    {backPreview ? <div className="mt-2 d-flex align-items-center gap-3">
                        <img src={mediaUrl(backPreview)} alt="National ID back preview" width="96" height="64" style={{ objectFit: 'cover', borderRadius: '4px' }} />
                        <Button type="button" variant="outline-danger" size="sm" onClick={() => {
                          setBackFile(null);
                          setBackPreview('');
                          setKeepBack('');
                          setBackError('');
                        }}>
                          Remove picture
                        </Button>
                      </div> : null}
                  </Form.Group>
                </Col>
                <Col xs={12} className="d-flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                    {isEdit ? 'Update tenant' : 'Add tenant'}
                  </Button>
                  <Button type="button" variant="light" onClick={() => navigate('/tenants')}>
                    Cancel
                  </Button>
                </Col>
              </Row>
            </Form>}
        </CardBody>
      </Card>
    </>;
};

export default TenantForm;
