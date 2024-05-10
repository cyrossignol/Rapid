import { dispatch as d3_dispatch } from 'd3-dispatch';
import { select as d3_select } from 'd3-selection';

import { uiIcon } from './icon.js';

import { uiMapRouletteDetails } from './maproulette_details.js';
import { uiMapRouletteHeader } from './maproulette_header.js';
import { uiViewOnMapRoulette } from './view_on_maproulette.js';
import { utilNoAuto, utilRebind } from '../util/index.js';


export function uiMapRouletteEditor(context) {
  const l10n = context.systems.l10n;
  const maproulette = context.services.maproulette;
  const dispatch = d3_dispatch('change');
  const mapRouletteDetails = uiMapRouletteDetails(context);
  const mapRouletteHeader = uiMapRouletteHeader(context);

  let _qaitem;
  let _comment;
  let _newComment;
  let _actionTaken;
  let _mapRouletteApiKey;


  function render(selection) {
    const header = selection.selectAll('.header')
      .data([0]);

    const headerEnter = header.enter()
      .append('div')
      .attr('class', 'header fillL');

    headerEnter
      .append('button')
      .attr('class', 'close')
      .on('click', () => context.enter('browse'))
      .call(uiIcon('#rapid-icon-close'));

    headerEnter
      .append('h3')
      .text(l10n.t('map_data.layers.maproulette.title'));

    let body = selection.selectAll('.body')
      .data([0]);

    body = body.enter()
      .append('div')
      .attr('class', 'body')
      .merge(body);

    let editor = body.selectAll('.mr-editor')
      .data([0]);

    editor.enter()
      .append('div')
      .attr('class', 'modal-section mr-editor')
      .merge(editor)
      .call(mapRouletteHeader.task(_qaitem))
      .call(mapRouletteDetails.task(_qaitem))
      .call(maprouletteSaveSection)
      .call(commentSaveSection);

    const footer = selection.selectAll('.footer')
      .data([0]);

    footer.enter()
      .append('div')
      .attr('class', 'footer')
      .merge(footer)
      .call(uiViewOnMapRoulette(context).task(_qaitem));
  }


  function maprouletteSaveSection(selection) {
    const errID = _qaitem?.id;
    const isSelected = errID && context.selectedData().has(errID);
    const isShown = (_qaitem && isSelected);
    let saveSection = selection.selectAll('.mr-save')
      .data((isShown ? [_qaitem] : []), d => `${d.id}-${d.status || 0}` );

    // exit
    saveSection.exit()
      .remove();

    // enter
    const saveSectionEnter = saveSection.enter()
      .append('div')
      .attr('class', 'mr-save save-section cf');

    // update
    saveSection = saveSectionEnter
      .merge(saveSection)
      .call(userDetails)
      .call(mRSaveButtons);
  }


  function getActionColor(action) {
    switch (action) {
      case 'FIXED':
        return '#62c9d3';
      case `CAN'T COMPLETE`:
        return '#fe5e63';
      case 'ALREADY FIXED':
        return '#ccb185';
      case 'NOT AN ISSUE':
        return '#f7ba59';
      default:
        return 'black';
    }
  }


  function commentSaveSection(selection) {
    const errID = _qaitem?.id;
    const isSelected = errID && context.selectedData().has(errID);
    const showNoteSaveSection = _qaitem?.showNoteSaveSection;

    let commentSave = selection.selectAll('.note-save')
      .data((isSelected && showNoteSaveSection ? [_qaitem] : []), d => d.status + d.id);

    // exit
    commentSave.exit()
      .remove();

    // enter
    let commentSaveEnter = commentSave.enter()
      .append('div')
      .attr('class', 'note-save save-section cf');

    commentSaveEnter
      .append('h4')
      .attr('class', 'note-save-header');

    // update
    commentSave = commentSaveEnter.merge(commentSave);
    commentSave.select('.note-save-header')  // Corrected class name
      .html(l10n.t('map_data.layers.maproulette.comment') + ' <span style="color: ' + getActionColor(_actionTaken) + ';">' + _actionTaken + '</span>');

    let commentTextarea = commentSaveEnter
      .append('textarea')
      .attr('class', 'new-comment-input')
      .attr('placeholder', l10n.t('map_data.layers.maproulette.inputPlaceholder'))
      .attr('maxlength', 1000)
      .property('value', function(d) { return d.newComment; })
      .call(utilNoAuto)
      .on('input.note-input', changeInput)
      .on('blur.note-input', changeInput)
      .style('resize', 'none');

    if (!commentTextarea.empty() && _newComment) {
      // autofocus the comment field for new notes
      commentTextarea.node().focus();
    }

    // update
    commentSave = commentSaveEnter
      .merge(commentSave)
      .call(userDetails)
      .call(submitButtons);

    function changeInput() {
      let input = d3_select(this);
      let val = input.property('value').trim() || undefined;

      // Check if _comment is defined before calling the update method
      if (_comment) {
        _comment = _comment.update({ _newComment: val });
      }

      _qaitem.update({ newComment: val });

      if (maproulette) {
        maproulette.replaceTask(_qaitem);  // update note cache
      }

      commentSave
        .call(mRSaveButtons);
    }
  }


  function userDetails(selection) {
    let detailSection = selection.selectAll('.detail-section')
      .data([0]);

    detailSection = detailSection.enter()
      .append('div')
      .attr('class', 'detail-section')
      .merge(detailSection);

    const osm = context.services.osm;
    if (!osm) return;

    // Add warning if user is not logged in
    const hasAuth = osm.authenticated();
    let authWarning = detailSection.selectAll('.auth-warning')
      .data(hasAuth ? [] : [0]);

    authWarning.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    let authEnter = authWarning.enter()
      .insert('div', '.tag-reference-body')
      .attr('class', 'field-warning auth-warning')
      .style('opacity', 0);

    authEnter
      .call(uiIcon('#rapid-icon-alert', 'inline'));

    authEnter
      .append('span')
      .text(l10n.t('map_data.layers.maproulette.login'));

    authEnter
      .append('a')
      .attr('target', '_blank')
      .call(uiIcon('#rapid-icon-out-link', 'inline'))
      .append('span')
      .text(l10n.t('login'))
      .on('click.note-login', d3_event => {
        d3_event.preventDefault();
        osm.authenticate();
      });

    authEnter
      .transition()
      .duration(200)
      .style('opacity', 1);


    osm.userDetails(function(err, user) {
      if (err) return;

      let userLink = d3_select(document.createElement('div'));

      if (user.image_url) {
        userLink
          .append('img')
          .attr('src', user.image_url)
          .attr('class', 'icon pre-text user-icon');
      }

      userLink
        .append('a')
        .attr('class', 'user-info')
        .text(user.display_name)
        .attr('href', osm.userURL(user.display_name))
        .attr('target', '_blank');
    });
  }


  function mRSaveButtons(selection) {
    const osm = context.services.osm;
    const hasAuth = osm && osm.authenticated();
    const errID = _qaitem?.id;

    const isSelected = errID && context.selectedData().has(errID);
    let buttonSection = selection.selectAll('.buttons')
      .data((isSelected ? [_qaitem] : []), d => d.status + d.id);

    // exit
    buttonSection.exit()
      .remove();

    // enter
    const buttonEnter = buttonSection.enter()
      .append('div')
      .attr('class', 'buttons');

    buttonEnter
      .append('button')
      .attr('class', 'button fixedIt-button action');

    buttonEnter
      .append('button')
      .attr('class', 'button cantComplete-button action');

    buttonEnter
      .append('button')
      .attr('class', 'button alreadyFixed-button action');

    buttonEnter
      .append('button')
      .attr('class', 'button notAnIssue-button action');

    // update
    buttonSection = buttonSection
      .merge(buttonEnter);

    buttonSection.select('.fixedIt-button')
      .attr('disabled', isSaveDisabled(_qaitem))
      .text(l10n.t('map_data.layers.maproulette.fixedIt'))
      .on('click.fixedIt', function(d3_event, d) {
        fixedIt(d3_event, d, selection);
      });

    buttonSection.select('.cantComplete-button')
      .attr('disabled', isSaveDisabled(_qaitem))
      .text(l10n.t('map_data.layers.maproulette.cantComplete'))
      .on('click.cantComplete', function(d3_event, d) {
        cantComplete(d3_event, d, selection);
      });

    buttonSection.select('.alreadyFixed-button')
      .attr('disabled', isSaveDisabled(_qaitem))
      .text(l10n.t('map_data.layers.maproulette.alreadyFixed'))
      .on('click.alreadyFixed', function(d3_event, d) {
        alreadyFixed(d3_event, d, selection);
      });

    buttonSection.select('.notAnIssue-button')
      .attr('disabled', isSaveDisabled(_qaitem))
      .text(l10n.t('map_data.layers.maproulette.notAnIssue'))
      .on('click.notAnIssue', function(d3_event, d) {
        notAnIssue(d3_event, d, selection);
      });


    function isSaveDisabled(d) {
      return (hasAuth && d.service === 'maproulette') ? null : true;
    }
  }


  function updateMRSaveButtonsVisibility(showNoteSaveSection) {
    if (showNoteSaveSection) {
      d3_select('.note-save').style('display', 'block');   // Show the commentSaveSection
      d3_select('.mr-save .buttons').style('display', 'none');  // Hide the buttons
    } else {
      d3_select('.note-save').style('display', 'none');  // Hide the commentSaveSection
      d3_select('.mr-save .buttons').style('display', '');  // Show the buttons
    }
  }


  function submitButtons(selection) {
    const osm = context.services.osm;
    osm.loadMapRouletteKey((err, preferences) => {
      if (err) {
        console.error(err); // eslint-disable-line no-console
        return;
      }
      _mapRouletteApiKey = preferences.maproulette_apikey_v2;
    });

    const errID = _qaitem?.id;
    const isSelected = errID && context.selectedData().has(errID);
    let buttonSection = selection.selectAll('.buttons')
      .data((isSelected ? [_qaitem] : [], d => `${d.id}-${d.status || 0}`));

    // exit
    buttonSection.exit()
      .remove();

    // enter
    const buttonEnter = buttonSection.enter()
      .append('div')
      .attr('class', 'buttons');

    buttonEnter
      .append('button')
      .attr('class', 'button cancel-button action');

    buttonEnter
      .append('button')
      .attr('class', 'button submit-button action')
      .attr('disabled', true);

    // update
    buttonSection = buttonSection
      .merge(buttonEnter);

    buttonSection.select('.cancel-button')
    .text(l10n.t('map_data.layers.maproulette.cancel'))
    .on('click.cancel', function(d3_event, d) {
      clickCancel(d3_event, d, selection);
    });

    buttonSection.select('.submit-button')
      .text(l10n.t('map_data.layers.maproulette.submit'))
      .on('click.submit', function(d3_event, d) {
          clickSumbit(d3_event, d, selection);
        });

      selection.select('.new-comment-input')
        .on('input.note-input', function() {
          let comment = d3_select(this).property('value').trim();
          let button = selection.select('.submit-button');
          if (comment !== '') {
            button.attr('disabled', null); // Enable the button if the comment is not empty
          } else {
            button.attr('disabled', true); // Disable the button if the comment is empty
          }
        });
  }


  function fixedIt(d3_event, d, selection) {
    this.blur();    // avoid keeping focus on the button - iD#4641
    d._status = 1;
    _actionTaken = 'FIXED';
    d.showNoteSaveSection = true;
    updateMRSaveButtonsVisibility(d.showNoteSaveSection);
    selection.call(commentSaveSection);
  }


  function cantComplete(d3_event, d, selection) {
    this.blur();    // avoid keeping focus on the button - iD#4641
    d._status = 6;
    _actionTaken = `CAN'T COMPLETE`;
    d.showNoteSaveSection = true;
    updateMRSaveButtonsVisibility(d.showNoteSaveSection);
    selection.call(commentSaveSection);
  }

  function alreadyFixed(d3_event, d, selection) {
    this.blur();    // avoid keeping focus on the button - iD#4641
    d._status = 5;
    _actionTaken = 'ALREADY FIXED';
    d.showNoteSaveSection = true;
    updateMRSaveButtonsVisibility(d.showNoteSaveSection);
    selection.call(commentSaveSection);
  }

  function notAnIssue(d3_event, d, selection) {
    this.blur();    // avoid keeping focus on the button - iD#4641
    d._status = 2;
    _actionTaken = 'NOT AN ISSUE';
    d.showNoteSaveSection = true;
    updateMRSaveButtonsVisibility(d.showNoteSaveSection);
    selection.call(commentSaveSection);
  }

  function clickCancel(d3_event, d, selection) {
    _actionTaken = '';
    d._status = '';
    d.showNoteSaveSection = false;
    updateMRSaveButtonsVisibility(d.showNoteSaveSection);
    selection.call(commentSaveSection);
  }

  function clickSumbit(d3_event, d) {
    this.blur();    // avoid keeping focus on the button - iD#4641
    const osm = context.services.osm;
    const userID = osm._userDetails.id;
    if (maproulette) {
      d.taskStatus = d._status;
      d.mapRouletteApiKey = _mapRouletteApiKey;
      d.comment = d3_select('.new-comment-input').property('value').trim();
      d.taskId = d.id;
      d.userId = userID;
      maproulette.postUpdate(d, (err, item) => {
        if (err) {
          console.error(err);  // eslint-disable-line no-console
          return;
        }
        // Update the UI only after all API requests have completed successfully
        maproulette.removeTask(d);
        dispatch.call('change', item);
      });
    }
  }

  render.error = function(val) {
    if (!arguments.length) return _qaitem;
    _qaitem = val;
    _qaitem.showNoteSaveSection = false;
    return render;
  };

  return utilRebind(render, dispatch, 'on');
}
