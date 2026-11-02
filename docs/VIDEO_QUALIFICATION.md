# Bounded video qualification

Status: **BOUNDED CHECKS WITH LIMITED COVERAGE**. Browser: Chrome/156.0.8078.80. Package checksum-manifest SHA-256: `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`. Browser window: 61022 ms; hard budget 180000 ms. [Raw evidence](../B2/artifacts/video-qualification/2026-11-02T09-22-07-880Z/results.json).

Public providers and the controlled native fixture are separate evidence. A native-video pass does not qualify YouTube, Vimeo or Twitch. PASS requires an actually observed state after real mouse input; unavailable/gated/captionless/live-only conditions are LIMITED. No login, consent/age attestation, CAPTCHA bypass, purchase, ad skip or forced ad-removal action is used. Audio output was muted.

| Variant | Provider | Check | Result | Evidence / limitation |
|---|---|---|---|---|
| no-extension | youtube | public/native player access | PASS | {"httpStatus":200,"title":"Me at the zoo - YouTube","frameOrigin":"https://www.youtube.com"} |
| no-extension | youtube | actual playback progresses after real click | PASS | {"before":{"time":0,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":941,"height":706,"frames":4,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false},"after":{"time":0.460304,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":941,"height":706,"frames":11,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false},"userGesture":"real mouse click on existing play control"} |
| no-extension | youtube | seek control changes playback position | PASS | {"before":0.462896,"after":7.630836,"duration":19.021,"seekEvents":1} |
| no-extension | youtube | fullscreen enters through player control | PASS | {"frame":true,"top":true} |
| no-extension | youtube | fullscreen exits before later controls | PASS | {"frame":false,"top":false,"userGesture":"real mouse click on player fullscreen toggle"} |
| no-extension | youtube | caption control enables an available showing/pressed state | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| no-extension | youtube | manual autoplay control can be switched off | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| no-extension | vimeo | public/native player access | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| no-extension | twitch | public/native player access | PASS | {"httpStatus":200,"title":"Monstercat - Twitch","frameOrigin":"https://www.twitch.tv"} |
| no-extension | twitch | actual playback progresses after real click | LIMITED | Error: No visible, enabled, unobscured matching player control was available. |
| no-extension | native-control | public/native player access | PASS | {"httpStatus":200,"title":"Controlled native media fixture","frameOrigin":"http://127.0.0.1:55878"} |
| no-extension | native-control | actual playback progresses after real click | PASS | {"before":{"time":0,"duration":5.055,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":640,"height":360,"frames":4,"droppedFrames":0,"fullscreen":false,"tracks":[{"language":"en","kind":"captions","mode":"disabled","activeCues":0}],"adDetected":false},"after":{"time":0.483364,"duration":5.055,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":640,"height":360,"frames":20,"droppedFrames":0,"fullscreen":false,"tracks":[{"language":"en","kind":"captions","mode":"disabled","activeCues":0}],"adDetected":false},"userGesture":"real mouse clic |
| no-extension | native-control | seek control changes playback position | PASS | {"before":0.485591,"after":2.019535,"duration":5.055,"seekEvents":1} |
| no-extension | native-control | fullscreen enters through player control | PASS | {"frame":true,"top":true} |
| no-extension | native-control | fullscreen exits before later controls | PASS | {"frame":false,"top":false,"userGesture":"real mouse click on player fullscreen toggle"} |
| no-extension | native-control | caption control enables an available showing/pressed state | PASS | {"tracks":[{"language":"en","kind":"captions","mode":"showing","activeCues":1}],"controlState":null} |
| bloku | youtube | public/native player access | PASS | {"httpStatus":200,"title":"Me at the zoo - YouTube","frameOrigin":"https://www.youtube.com"} |
| bloku | youtube | actual playback progresses after real click | PASS | {"before":{"time":0.016962,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":989,"height":742,"frames":4,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false},"after":{"time":0.42097,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":989,"height":742,"frames":11,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false},"userGesture":"real mouse click on existing play control"} |
| bloku | youtube | seek control changes playback position | PASS | {"before":0.422163,"after":7.609418,"duration":19.021,"seekEvents":1} |
| bloku | youtube | fullscreen enters through player control | PASS | {"frame":true,"top":true} |
| bloku | youtube | fullscreen exits before later controls | PASS | {"frame":false,"top":false,"userGesture":"real mouse click on player fullscreen toggle"} |
| bloku | youtube | caption control enables an available showing/pressed state | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| bloku | youtube | autoplay preference switches an observed on control off | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| bloku | youtube | comments container hidden after confirmed setting | PASS | {"before":{"present":2,"visible":true},"after":"hidden","settingConfirmed":true} |
| bloku | youtube | recommendations container hidden after confirmed setting | PASS | {"before":{"present":3,"visible":true},"after":"hidden","settingConfirmed":true} |
| bloku | youtube | player remains visible and advances after distraction changes | PASS | {"before":{"time":12.877684,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":989,"height":742,"frames":131,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false},"after":{"time":13.203364,"duration":19.021,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":989,"height":742,"frames":135,"droppedFrames":0,"fullscreen":false,"tracks":[],"adDetected":false}} |
| bloku | vimeo | public/native player access | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| bloku | twitch | public/native player access | PASS | {"httpStatus":200,"title":"Monstercat - Twitch","frameOrigin":"https://www.twitch.tv"} |
| bloku | twitch | actual playback progresses after real click | LIMITED | Error: Expected media/control state was not observed within the bounded wait. |
| bloku | native-control | public/native player access | PASS | {"httpStatus":200,"title":"Controlled native media fixture","frameOrigin":"http://127.0.0.1:55878"} |
| bloku | native-control | actual playback progresses after real click | PASS | {"before":{"time":0,"duration":5.055,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":640,"height":360,"frames":4,"droppedFrames":0,"fullscreen":false,"tracks":[{"language":"en","kind":"captions","mode":"disabled","activeCues":0}],"adDetected":false},"after":{"time":0.491644,"duration":5.055,"paused":false,"ended":false,"readyState":4,"error":null,"visible":true,"width":640,"height":360,"frames":18,"droppedFrames":6,"fullscreen":false,"tracks":[{"language":"en","kind":"captions","mode":"disabled","activeCues":0}],"adDetected":false},"userGesture":"real mouse clic |
| bloku | native-control | seek control changes playback position | PASS | {"before":0.511114,"after":2.014528,"duration":5.055,"seekEvents":1} |
| bloku | native-control | fullscreen enters through player control | PASS | {"frame":true,"top":true} |
| bloku | native-control | fullscreen exits before later controls | PASS | {"frame":false,"top":false,"userGesture":"real mouse click on player fullscreen toggle"} |
| bloku | native-control | caption control enables an available showing/pressed state | PASS | {"tracks":[{"language":"en","kind":"captions","mode":"showing","activeCues":1}],"controlState":null} |

Potential comparison regressions (unconfirmed): []. Public main-content ad behavior and all unsupported caption/seek controls remain unqualified. The controlled fixture uses the [MDN flower sample](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4), whose actual hash and local VTT hash are in the raw evidence. [Vimeo official demo](https://vimeo.com/76979871); [requested Twitch channel](https://www.twitch.tv/monstercat); [MDN native video documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video).

Cleanup evidence: {"profiles":[{"profile":"profile-2026-11-02T09-22-07-880Z-no-extension","processExited":true,"removed":true},{"profile":"profile-2026-11-02T09-22-07-880Z-bloku","processExited":true,"removed":true}],"serverClosed":true,"snapshotRemoved":true}.
