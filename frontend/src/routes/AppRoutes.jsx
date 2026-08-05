import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RouteFallback } from '@/components/common/RouteFallback';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { HostLayout } from '@/layouts/HostLayout';
import { OwnerLayout } from '@/layouts/OwnerLayout';
import { PlayerLayout } from '@/layouts/PlayerLayout';
import { PublicLayout } from '@/layouts/PublicLayout';

/* Every page is its own chunk so a first paint only ships one screen. */
const Landing = lazy(() => import('@/pages/public/LandingPage'));
const NotFound = lazy(() => import('@/pages/public/NotFoundPage'));
const Auth = lazy(() => import('@/pages/auth/AuthPage'));
const OwnerOnboarding = lazy(() => import('@/pages/owner/OwnerOnboardingPage'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLoginPage'));

const PlayerHome = lazy(() => import('@/pages/player/HomePage'));
const PlayerOnboarding = lazy(() => import('@/pages/player/OnboardingPage'));
const Explore = lazy(() => import('@/pages/player/ExplorePage'));
const Venue = lazy(() => import('@/pages/player/VenuePage'));
const Checkout = lazy(() => import('@/pages/player/CheckoutPage'));
const BookingSuccess = lazy(() => import('@/pages/player/BookingSuccessPage'));
const Bookings = lazy(() => import('@/pages/player/BookingsPage'));
const BookingDetail = lazy(() => import('@/pages/player/BookingDetailPage'));
const SplitPayment = lazy(() => import('@/pages/player/SplitPaymentPage'));
const PaymentRetry = lazy(() => import('@/pages/player/PaymentRetryPage'));
const Matchday = lazy(() => import('@/pages/player/MatchdayPage'));
const Review = lazy(() => import('@/pages/player/ReviewPage'));
const Cancel = lazy(() => import('@/pages/player/CancelPage'));
const Rewards = lazy(() => import('@/pages/player/RewardsPage'));

const OpenGames = lazy(() => import('@/pages/solo/OpenGamesPage'));
const GameDetail = lazy(() => import('@/pages/solo/GameDetailPage'));
const LfgAlerts = lazy(() => import('@/pages/solo/LfgAlertPage'));
const Ticket = lazy(() => import('@/pages/solo/TicketPage'));

const Tournament = lazy(() => import('@/pages/host/TournamentPage'));
const MultiPitch = lazy(() => import('@/pages/host/MultiPitchPage'));
const Reserve = lazy(() => import('@/pages/host/ReservePage'));

const OwnerDashboard = lazy(() => import('@/pages/owner/DashboardPage'));
const OwnerCalendar = lazy(() => import('@/pages/owner/CalendarPage'));
const OwnerBookings = lazy(() => import('@/pages/owner/BookingsPage'));
const OwnerPayments = lazy(() => import('@/pages/owner/PaymentsPage'));
const OwnerVenueSetup = lazy(() => import('@/pages/owner/VenueSetupPage'));
const OwnerCustomers = lazy(() => import('@/pages/owner/CustomersPage'));
const OwnerPromotions = lazy(() => import('@/pages/owner/PromotionsPage'));
const OwnerReviews = lazy(() => import('@/pages/owner/ReviewsPage'));
const OwnerStaff = lazy(() => import('@/pages/owner/StaffPage'));

const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminTurfRequests = lazy(() => import('@/pages/admin/TurfRequestsPage'));
const AdminRequestReview = lazy(() => import('@/pages/admin/RequestReviewPage'));
const AdminTurfs = lazy(() => import('@/pages/admin/TurfsPage'));
const AdminTurfDetails = lazy(() => import('@/pages/admin/TurfDetailsPage'));
const AdminUsers = lazy(() => import('@/pages/admin/UsersPage'));
const AdminUserGrowth = lazy(() => import('@/pages/admin/UserGrowthPage'));
const AdminUserSegments = lazy(() => import('@/pages/admin/UserSegmentsPage'));
const AdminActivity = lazy(() => import('@/pages/admin/ActivityPage'));
const AdminAdmins = lazy(() => import('@/pages/admin/AdminsPage'));
const AdminProfile = lazy(() => import('@/pages/admin/ProfilePage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="auth" element={<Auth />} />
          <Route path="owner/onboarding" element={<OwnerOnboarding />} />
          <Route path="admin/login" element={<AdminLogin />} />
        </Route>

        <Route element={<PlayerLayout />}>
          <Route path="player">
            <Route index element={<PlayerHome />} />
            <Route path="onboarding" element={<PlayerOnboarding />} />
            <Route path="explore" element={<Explore />} />
            <Route path="venues/:venueId" element={<Venue />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="booking-success" element={<BookingSuccess />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:bookingId" element={<BookingDetail />} />
            <Route path="split-payment" element={<SplitPayment />} />
            <Route path="payment-retry" element={<PaymentRetry />} />
            <Route path="matchday" element={<Matchday />} />
            <Route path="review" element={<Review />} />
            <Route path="cancel" element={<Cancel />} />
            <Route path="rewards" element={<Rewards />} />
          </Route>

          <Route path="solo">
            <Route index element={<Navigate to="open-games" replace />} />
            <Route path="open-games" element={<OpenGames />} />
            <Route path="games/:gameId" element={<GameDetail />} />
            <Route path="alerts" element={<LfgAlerts />} />
            <Route path="ticket" element={<Ticket />} />
          </Route>
        </Route>

        <Route path="host" element={<HostLayout />}>
          <Route index element={<Navigate to="/player?mode=host" replace />} />
          {/* The prototype's host/dashboard.html was only a redirect stub. */}
          <Route path="dashboard" element={<Navigate to="/player?mode=host" replace />} />
          <Route path="tournament" element={<Tournament />} />
          <Route path="multi-pitch" element={<MultiPitch />} />
          <Route path="reserve" element={<Reserve />} />
        </Route>

        <Route path="owner" element={<OwnerLayout />}>
          <Route index element={<OwnerDashboard />} />
          <Route path="calendar" element={<OwnerCalendar />} />
          <Route path="bookings" element={<OwnerBookings />} />
          <Route path="payments" element={<OwnerPayments />} />
          <Route path="venue-setup" element={<OwnerVenueSetup />} />
          <Route path="customers" element={<OwnerCustomers />} />
          <Route path="promotions" element={<OwnerPromotions />} />
          <Route path="reviews" element={<OwnerReviews />} />
          <Route path="staff" element={<OwnerStaff />} />
        </Route>

        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="turf-requests" element={<AdminTurfRequests />} />
          <Route path="turf-requests/:requestId" element={<AdminRequestReview />} />
          <Route path="turfs" element={<AdminTurfs />} />
          <Route path="turfs/:turfId" element={<AdminTurfDetails />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/growth" element={<AdminUserGrowth />} />
          <Route path="users/segments" element={<AdminUserSegments />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
