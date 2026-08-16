import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Skill } from '@/components/ui/Tags';
import { formatBdt } from '@/utils/format';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

/** Open-game tile used on player home and the solo listings. */
function GameCardBase({ game, className }) {
    const { id, title, status, statusTone = 'green', skill, when, distanceKm, price, urgent } = game;

    return (
        <Link
            className={cn('game-card', urgent && 'game-card-urgent', className)}
            to={paths.solo.game(id)}
            style={{ textDecoration: 'none', color: 'var(--text)' }}
        >
            <div className="between">
                <Badge tone={statusTone}>{status}</Badge>
                {skill ? <Skill>{skill}</Skill> : null}
            </div>
            {/* h3, not h4: this card is rendered directly under the section's
                h2, and jumping a level breaks screen-reader navigation. */}
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
            <div className="between">
                <span className="subtle">
                    {when}
                    {distanceKm != null ? ` · ${distanceKm} km` : ''}
                </span>
                <b className="num">{formatBdt(price)}</b>
            </div>
        </Link>
    );
}

export const GameCard = memo(GameCardBase);
