import { Link } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { paths } from '@/routes/paths';

/** Single centred footer used across the public and player surfaces. */
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="stack-sm" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Brand size={24} />
          <p className="subtle" style={{ margin: 0 }}>
            Book. Play. Repeat. · Dhaka, Bangladesh
          </p>
          <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Link to={paths.player.explore}>Explore Venues</Link>
            <Link to={paths.solo.openGames}>Open Games</Link>
            <Link to={paths.player.home}>Player Dashboard</Link>
            <Link to={paths.owner.onboarding}>List Your Turf</Link>
            <Link to={paths.player.rewards}>Rewards</Link>
            <Link to={paths.host.hub}>Tournaments</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
