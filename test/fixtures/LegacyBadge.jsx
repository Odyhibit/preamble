import PropTypes from 'prop-types';

/** Colored count badge (legacy, PropTypes-era). */
function LegacyBadge(props) {
  return null;
}

LegacyBadge.propTypes = {
  count: PropTypes.number,
  color: PropTypes.string,
  onClick: PropTypes.func,
};

export default LegacyBadge;
