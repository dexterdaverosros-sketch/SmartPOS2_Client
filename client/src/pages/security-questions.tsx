import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

const securityQuestionsSchema = z.object({
  question1: z.string().min(1, 'Question 1 is required'),
  answer1: z.string().min(1, 'Answer 1 is required'),
  question2: z.string().min(1, 'Question 2 is required'),
  answer2: z.string().min(1, 'Answer 2 is required'),
  question3: z.string().min(1, 'Question 3 is required'),
  answer3: z.string().min(1, 'Answer 3 is required'),
});

type SecurityQuestionsFormData = z.infer<typeof securityQuestionsSchema>;

const SecurityQuestionsPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const form = useForm<SecurityQuestionsFormData>({
    resolver: zodResolver(securityQuestionsSchema),
    defaultValues: {
      question1: '',
      answer1: '',
      question2: '',
      answer2: '',
      question3: '',
      answer3: '',
    },
  });

  const onSubmit = async (data: SecurityQuestionsFormData) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await api.post('/api/auth/set-security-questions', {
        userId: user.id,
        questions: [data.question1, data.question2, data.question3],
        answers: [data.answer1, data.answer2, data.answer3],
      });
      toast({
        title: 'Success',
        description: 'Security questions saved successfully!',
      });
      navigate('/admin'); // Redirect to admin main page
    } catch (error) {
      console.error('Failed to save security questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to save security questions. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Set Security Questions</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Question 1</h2>
              <FormField
                control={form.control}
                name="question1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Security Question 1</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., What is your mother's maiden name?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="answer1"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Answer 1</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Your answer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Question 2</h2>
              <FormField
                control={form.control}
                name="question2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Security Question 2</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., What was the name of your first pet?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="answer2"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Answer 2</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Your answer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Question 3</h2>
              <FormField
                control={form.control}
                name="question3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Security Question 3</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., What is your favorite book?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="answer3"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Answer 3</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Your answer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit">Save Security Questions</Button>
          </form>
        </Form>
      </div>
    </Layout>
  );
};

export default SecurityQuestionsPage;
