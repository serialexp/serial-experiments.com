<div style="width:620px;margin:0 auto;">
    <div style="float:right;width:290px;">
        <fieldset>
            <legend>Result</legend>
            <dl>
                <dt><input type="button" onclick="document.getElementById('result').innerHTML = boom('yes');" value="Shoot!" /><input type="button" onclick="average();" value="Average (of 10k)?" /></dt>
                <dd id="result"></dd>
            </dl>
        </fieldset>
    </div>
    <div style="width:330px;float:right;">
        <form>
            <fieldset>
                <legend>Armor</legend>
                <dl>
                    <dt><b>All</b></dt>
                    <dd><input type="text" onkeyup="setall(this.value);"/></dd>
                    <dt>Head (1)</dt>
                    <dd><input type="text" id="Head" value="25"/></dd>
                    <dt>Torso (2-4)</dt>
                    <dd><input type="text" id="Torso" value="25"/></dd>
                    <dt>Right Arm (5)</dt>
                    <dd><input type="text" id="Right Arm" value="25"/></dd>
                    <dt>Left Arm (6)</dt>
                    <dd><input type="text" id="Left Arm" value="25"/></dd>
                    <dt>Right Leg (7-8)</dt>
                    <dd><input type="text" id="Right Leg" value="25"/></dd>
                    <dt>Left Leg (9-10)</dt>
                    <dd><input type="text" id="Left Leg" value="25"/></dd>
                </dl>
                <dl>
                    <dt><b>BTM</b></dt>
                    <dd><input type="text" id="btm" value="3"/></dd>
                </dl>
            </fieldset>
            <fieldset>
                <legend>Weapon</legend>
                <dl>
                    <dt>Attack Bonus</dt>
                    <dd><input type="text" id="bonus" value="12"/></dd>
                    <dt>Range</dt>
                    <dd>
                        <select id="range">
                            <option value="10">Point Blank</option>
                            <option value="15">Short</option>
                            <option value="20">Medium</option>
                            <option value="25">Long</option>
                            <option value="30">Extreme</option>
                        </select>
                    </dd>
                    <dt>Damage</dt>
                    <dd><input type="text" id="count" size="4" value="6"/>D<input type="text" id="sides" size="4" value="6"/>+<input type="text" id="plus" size="4" value="2"/></dd>
                    <dt>AP?</dt>
                    <dd><input type="checkbox" id="ap" value="1" checked="checked"/></dd>
                    <dt>Incendiary?</dt>
                    <dd><input type="checkbox" id="incendiary" value="1" /></dd>
                    <dt>Auto</dt>
                    <dd>
                        <label><input type="radio" name="burst" id="burst" checked="checked" value="" /> Normal</label>
                        <label><input type="radio" name="burst" id="burstBurst" value="burst" /> Burst</label>
                        <label><input type="radio" name="burst" id="burstAuto" value="full" /> Full Auto</label>
                    </dd>
                    <dt>Magazine Size</dt>
                    <dd><input type="text" id="autoBullets" value="30"/></dd>
                </dl>
            </fieldset>
            <script>
                var locations = {
                    1: "Head",
                    2: "Torso",
                    3: "Torso",
                    4: "Torso",
                    5: "Right Arm",
                    6: "Left Arm",
                    7: "Right Leg",
                    8: "Right Leg",
                    9: "Left Leg",
                    10: "Left Leg"
                };
                var uniqueLocs = ["Head", "Torso", "Right Arm", "Left Arm", "Right Leg", "Left Leg"];
                function die() {
                    return Math.ceil(Math.random() * 10);
                }
                function v(id) {
                    if (document.getElementById(id).type == 'checkbox' || document.getElementById(id).type == 'radio') return document.getElementById(id).checked;
                    if (parseInt(document.getElementById(id).value)==document.getElementById(id).value) {
                        return parseInt(document.getElementById(id).value)?parseInt(document.getElementById(id).value):0;
                    } else {
                        return document.getElementById(id).value;
                    }
                }
                function set(id, val) {
                    document.getElementById(id).value = val;
                }
                function setall(value) {
                    for(key in locations) {
                        set(locations[key], value);
                    }
                }
                function boom(inText) {
                    var result = "";

                    var toHit = die();
                    var totalHit = toHit + v('bonus');
                    if (v('burstBurst')) totalHit += 3;
                    if (v('burstAuto')) totalHit += Math.floor(v('autoBullets')/10);
                    var missed = false;

                    result += "Rolled a "+toHit+".";
                    if (toHit == 1) {
                        result += " You fail!";
                        missed = true;
                    }
                    while(toHit == 10) {
                        toHit = die();
                        totalHit += toHit;
                    }

                    result += "<br/>To hit was "+totalHit+".";
                    if (v('range') > totalHit) {
                        result += "<br/>You missed.";
                        missed = true;
                    }

                    var combinedDamage = {};
                    var combinedNextDamage = {};
                    var destroyed = {}
                    for(var l = 0; l < uniqueLocs.length; l++) {
                        combinedDamage[uniqueLocs[l]] = 0;
                        combinedNextDamage[uniqueLocs[l]] = 0;
                        destroyed[uniqueLocs[l]] = false;
                    }
                    if (!missed) {
                        var hits = 1;

                        if (v('burstBurst')) {
                            hits = Math.ceil(Math.random()*3);
                        }
                        if (v('burstAuto')) {
                            hits = Math.min(totalHit - v('range'), v('autoBullets'));
                        }

                        result += "<br /><br />Target is hit "+hits+" times";
                        var hitsSummary = "";
                        for(var h = 0; h < hits; h++) {
                            result += "<br /><br />For hit "+(h+1)+".";

                            var hitOn = die();
                            var location = locations[hitOn];
                            result += "<br/>You hit the "+location+".";


                            var armor = v(location);
                            result += "<br/>Armor on location is "+armor+".";

                            var count = v('count');
                            var damage = 0;
                            for(var i = 0; i < count; i++) {
                                damage += Math.ceil(Math.random()*v('sides'));
                            }
                            damage += v('plus');

                            result += "<br/>Damage would be "+damage+".";

                            if (v('ap')) {
                                armor = Math.floor(armor * 0.5);
                                result += "<br/>Armor piercing reduces armor to "+armor+".";
                            }
                            var trueDamage = Math.max(damage - armor, 0);

                            if (trueDamage > 0) {
                                var btm = v('btm');
                                result += "<br/>Damage done is "+trueDamage+".";
                                if (v('ap')) {
                                    trueDamage = Math.floor(trueDamage * 0.5);
                                    result += "<br/>Armor piercing halves damage to "+trueDamage+".";
                                }
                                result += "<br/>BTM reduced damage by "+btm+".";

                                var finalDamage = Math.max(trueDamage - btm, 1);
                                if (location == 'Head') {
                                    finalDamage = Math.floor(finalDamage * 2);
                                    result += "<br/>Hitting the head doubles damage to "+finalDamage+".";
                                }

                                if (v('incendiary')) {
                                    var fireDamage = Math.ceil(Math.random()*6);
                                    var secondFireDamage = Math.ceil(Math.random()*3);
                                    result += "<br />The target burns for "+fireDamage+" this round, and "+secondFireDamage+" next.";
                                    finalDamage += fireDamage;
                                    combinedNextDamage[location] += secondFireDamage;
                                }

                                result += "<br/>Final damage is <b>"+finalDamage+"</b>.";
                            } else {
                                result += "<br/>The shot <b>didn't penetrate</b>.";
                                finalDamage = 0;
                            }
                            if (finalDamage >= 8) {
                                destroyed[location] = true;
                            }
                            combinedDamage[location] += finalDamage;
                        }

                        var summary = "";
                        var here = 0;
                        for(var l = 0; l < uniqueLocs.length; l++) {
                            if (combinedDamage[uniqueLocs[l]] > 0) summary += "<br />"+uniqueLocs[l]+": "+combinedDamage[uniqueLocs[l]];
                            here += combinedDamage[uniqueLocs[l]];
                        }
                        summary += "<br /><strong>Damage: "+here+"</strong>";

                        for(var l = 0; l < uniqueLocs.length; l++) {
                            if (combinedNextDamage[uniqueLocs[l]] > 0) summary += "<br />Next Round "+uniqueLocs[l]+": "+combinedNextDamage[uniqueLocs[l]];
                        }
                        summary += "<br />";
                        for(var l = 0; l < uniqueLocs.length; l++) {
                            if (destroyed[uniqueLocs[l]] == true) {
                                if (uniqueLocs[l] == "Head") {
                                    summary += "<br /><span style=\"color:red;\">The head splatters apart in a rain of blood!</span>";
                                } else {
                                    summary += "<br /><span style=\"color:darkred;\">"+uniqueLocs[l]+" destroyed completely!</span>";
                                }
                            }
                        }
                        result = summary+"<br/><br />"+result

                        var combinedTotal = 0;
                        for(var l = 0; l < uniqueLocs.length; l++) {
                            combinedTotal += combinedDamage[uniqueLocs[l]];
                        }
                        combinedDamage = combinedTotal;
                    } else {
                        combinedDamage = 0;
                    }

                    return inText=='yes'?result:combinedDamage;
                }
                function average() {
                    var total = 0;
                    for(var i = 0; i < 10000; i++) {
                        var res = boom('no');
                        total += res;
                    }
                    alert('Average is '+(total/10000));
                }
            </script>
        </form>
    </div>
</div>