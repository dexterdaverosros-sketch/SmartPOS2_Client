import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api'; // Import the api utility

const forgotPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

const securityAnswersSchema = z.object({
  answer1: z.string().min(1, 'Answer 1 is required'),
  answer2: z.string().min(1, 'Answer 2 is required'),
  answer3: z.string().min(1, 'Answer 3 is required'),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(6, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type SecurityAnswersFormData = z.infer<typeof securityAnswersSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [stage, setStage] = useState<'username' | 'questions' | 'reset'>('username');
  const [username, setUsername] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<string[]>([]);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [remainingLockoutTime, setRemainingLockoutTime] = useState(0);

  const usernameForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: '',
    },
  });

  const securityAnswersForm = useForm<SecurityAnswersFormData>({
    resolver: zodResolver(securityAnswersSchema),
    defaultValues: {
      answer1: '',
      answer2: '',
      answer3: '',
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutUntil) {
      timer = setInterval(() => {
        const now = new Date();
        const diff = lockoutUntil.getTime() - now.getTime();
        if (diff <= 0) {
          setLockoutUntil(null);
          setRemainingLockoutTime(0);
          toast({
            title: 'Account Unlocked',
            description: 'You can now try again.',
          });
        } else {
          setRemainingLockoutTime(Math.ceil(diff / 1000));
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutUntil, toast]);

  const onUsernameSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/get-security-questions', { username: data.username });
      if (response.data.questions && response.data.questions.length === 3) {
        setUsername(data.username);
        setSecurityQuestions(response.data.questions);
        setStage('questions');
      } else {
        toast({
          title: 'Error',
          description: 'Security questions not set for this account or user not found.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error fetching security questions:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch security questions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSecurityAnswersSubmit = async (data: SecurityAnswersFormData) => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/verify-security-answers', {
        username,
        answers: [data.answer1, data.answer2, data.answer3],
      });

      if (response.data.success) {
        setStage('reset');
      } else {
        toast({
          title: 'Verification Failed',
          description: response.data.error || 'Incorrect security answers.',
          variant: 'destructive',
        });
        if (response.status === 429) { // Locked out
          const lockoutTime = new Date(new Date().getTime() + 3 * 60 * 1000); // 3 minutes from now
          setLockoutUntil(lockoutTime);
        }
      }
    } catch (error: any) {
      console.error('Error verifying security answers:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to verify security answers.',
        variant: 'destructive',
      });
      if (error.response?.status === 429) {
        const lockoutTime = new Date(new Date().getTime() + (error.response.data.remainingTime || 3) * 60 * 1000);
        setLockoutUntil(lockoutTime);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPasswordSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        username,
        newPassword: data.newPassword,
      });
      toast({
        title: 'Password Reset',
        description: 'Your password has been successfully reset. Please log in with your new password.',
      });
      setLocation('/admin-login');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to reset password.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (lockoutUntil) {
      return (
        <div className="text-center p-6 bg-red-50 dark:bg-red-900 rounded-xl shadow-md">
          <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Account Locked</h3>
          <p className="text-red-600 dark:text-red-400">
            Too many failed attempts. Please try again in {Math.ceil(remainingLockoutTime / 60)} minutes and {remainingLockoutTime % 60} seconds.
          </p>
        </div>
      );
    }

    switch (stage) {
      case 'username':
        return (
          <Form {...usernameForm}>
            <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="space-y-6">
              <FormField
                control={usernameForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username"
                        data-testid="input-username-reset"
                        className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-get-questions"
                className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
                style={{ boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)' }}
              >
                {isLoading ? 'Loading...' : 'Get Security Questions'}
              </Button>
            </form>
          </Form>
        );
      case 'questions':
        return (
          <Form {...securityAnswersForm}>
            <form onSubmit={securityAnswersForm.handleSubmit(onSecurityAnswersSubmit)} className="space-y-6">
              {securityQuestions.map((question, index) => (
                <FormField
                  key={index}
                  control={securityAnswersForm.control}
                  name={`answer${index + 1}` as keyof SecurityAnswersFormData}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">{question}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={`Answer to question ${index + 1}`}
                          className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-verify-answers"
                className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
                style={{ boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)' }}
              >
                {isLoading ? 'Verifying...' : 'Verify Answers'}
              </Button>
            </form>
          </Form>
        );
      case 'reset':
        return (
          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-6">
              <FormField
                control={resetPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-reset-password-final"
                className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
                style={{ boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)' }}
              >
                {isLoading ? 'Resetting...' : 'Set New Password'}
              </Button>
            </form>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white flex items-center justify-center"
    >
      <div className="p-6 max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8 pt-4"
        >
          <Shield className="w-16 h-16 text-primary-500 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
          <p className="text-gray-600 mt-2">
            {stage === 'username' && 'Enter your username to proceed.'}
            {stage === 'questions' && 'Answer your security questions.'}
            {stage === 'reset' && 'Set your new password.'}
          </p>
        </motion.div>
        
        {renderContent()}
        
        <button
          onClick={() => setLocation('/admin-login')}
          data-testid="button-back"
          className="mt-6 text-gray-400 flex items-center touch-feedback mx-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </button>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;