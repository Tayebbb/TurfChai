import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/forms/Field';
import { PageTitle } from '@/components/common/PageTitle';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const FILTERS = ['All (214)', 'Needs response (2)', '🧒 Parent reviews (18)', 'Low rating'];

const RATING_BREAKDOWN = [
  { star: '5', width: '78%', count: '167' },
  { star: '4', width: '15%', count: '32' },
  { star: '3', width: '5%', count: '11' },
  { star: '2', width: '1%', count: '3' },
  { star: '1', width: '.5%', count: '1' },
];

const CATEGORY_AVERAGES = [
  { id: 'surface', label: 'Surface', value: '4.9' },
  { id: 'lighting', label: 'Lighting', value: '4.8' },
  { id: 'cleanliness', label: 'Cleanliness', value: '4.7' },
  { id: 'amenities', label: 'Amenities', value: '4.3' },
  { id: 'safety', label: 'Safety', value: '4.9' },
  { id: 'youth', label: '🧒 Youth-friendliness', value: '4.6' },
];

const DEFAULT_REPLY =
  "Thanks Rafi! We're expanding the changing room this month — hope to see the team again Friday. 🙌";

export default function ReviewsPage() {
  const { showToast } = useToast();
  const chips = useFilterChips(['All (214)']);
  const [reply, setReply] = useState(DEFAULT_REPLY);