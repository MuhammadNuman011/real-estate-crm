import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import { useAuthContext } from '@/context/useAuthContext';
import { useNotificationContext } from '@/context/useNotificationContext';
import httpClient from '@/helpers/httpClient';

const useBrokerSignIn = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { saveSession } = useAuthContext();
  const { showNotification } = useNotificationContext();
  const loginFormSchema = yup.object({
    email: yup.string().trim().email('Please enter a valid email').required('Please enter your email'),
    password: yup.string().required('Please enter your password')
  });
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });
  const login = handleSubmit(async values => {
    setLoading(true);
    try {
      const res = await httpClient.post('/api/broker/login', {
        email: values.email.trim(),
        password: values.password
      });
      if (res.data?.token) {
        saveSession({
          role: 'broker',
          token: res.data.token,
          broker: res.data.broker
        });
        navigate('/properties', { replace: true });
        showNotification({
          message: 'Successfully logged in. Redirecting....',
          variant: 'success'
        });
      }
    } catch (e) {
      const data = e.response?.data;
      const fieldMessage = data?.fields ? Object.values(data.fields).filter(Boolean).join(' ') : '';
      showNotification({
        message: fieldMessage || data?.error || 'Unable to log in. Please try again.',
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  });
  return {
    loading,
    login,
    control
  };
};

export default useBrokerSignIn;
