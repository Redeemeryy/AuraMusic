module.exports = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "primary": "#0058bc",
            "primary-container": "#0070eb",
            "on-primary": "#ffffff",
            "secondary": "#006a65",
            "secondary-container": "#5df6ec",
            "tertiary": "#8a2bb9",
            "tertiary-container": "#a649d5",
            "surface": "#fbf9fc",
            "surface-container-lowest": "#ffffff",
            "surface-container-low": "#f5f3f6",
            "surface-container": "#efedf0",
            "surface-container-high": "#e9e7eb",
            "on-surface": "#1b1b1e",
            "on-surface-variant": "#414755",
            "outline": "#717786",
            "outline-variant": "#c1c6d7"
          }
        }
      }
    };
module.exports.content = ['./app/src/main/assets/web/*.{html,js}'];
module.exports.theme.extend.spacing = { 'safe': '0px' };
module.exports.theme.extend.boxShadow = {...module.exports.theme.extend.boxShadow, 'xs': '0 1px 2px rgb(0 0 0 / .04)', '2xs': '0 1px 1px rgb(0 0 0 / .02)'};
module.exports.theme.extend.backdropBlur = { 'xs': '2px' };
module.exports.safelist = ['bg-primary','text-white','bg-primary/10','text-primary'];
